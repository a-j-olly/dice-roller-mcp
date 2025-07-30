/**
 * Integration tests for the MCP server.
 * Tests the server's JSON-RPC communication and tool responses.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { 
	RollResponse, 
	RollMultipleResponse, 
	McpResponse 
} from '../src/dice/types.js';

// Type aliases for test responses
type DiceRollResponse = RollResponse;
type MultipleRollResponse = RollMultipleResponse;

describe('MCP Server Integration', () => {
	let serverProcess: ChildProcess;
	let server: McpServer;

	beforeEach(async () => {
		// Start the server as a subprocess
		serverProcess = spawn('node', ['build/src/index.js', '--stdio'], {
			stdio: ['pipe', 'pipe', 'pipe']
		});

		// Wait for server to start
		await new Promise(resolve => setTimeout(resolve, 2000));
	});

	afterEach(() => {
		if (serverProcess) {
			serverProcess.kill();
		}
	});

	/**
	 * Helper function to send a request to the server and get response
	 */
	async function sendRequest(request: any): Promise<McpResponse> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Request timed out'));
			}, 5000);

			serverProcess.stdin!.write(JSON.stringify(request) + '\n');

			serverProcess.stdout!.once('data', (data) => {
				try {
					const response = JSON.parse(data.toString().trim());
					clearTimeout(timeout);
					resolve(response);
				} catch (error) {
					clearTimeout(timeout);
					reject(new Error(`Failed to parse response: ${error}`));
				}
			});
		});
	}

	/**
	 * Helper function to extract dice result from MCP response
	 */
	function extractDiceResult(response: McpResponse): DiceRollResponse | MultipleRollResponse {
		if (!response.result) {
			throw new Error('Response has no result');
		}
		const content = response.result.content[0].text;
		return JSON.parse(content);
	}

	describe('roll_dice tool', () => {
		test('basic dice roll', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 3,
						dice_sides: 6
					}
				},
				id: 1
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(response.jsonrpc).toBe('2.0');
			expect(response.id).toBe(1);
			expect(diceResult.result.total).toBeGreaterThanOrEqual(3);
			expect(diceResult.result.total).toBeLessThanOrEqual(18);
			expect(diceResult.result.operation).toBe('3d6');
			expect(diceResult.result.description).toBe('Rolled 3d6');
			expect(diceResult.result.dice).toHaveLength(3);
		});

		test('roll with modifier', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 2,
						dice_sides: 20,
						modifier: 5
					}
				},
				id: 2
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('2d20+5');
			expect(diceResult.result.description).toBe('Rolled 2d20, adding 5');
			expect(diceResult.result.total).toBeGreaterThanOrEqual(7); // 2 + 5
			expect(diceResult.result.total).toBeLessThanOrEqual(45); // 40 + 5
		});

		test('keep highest dice', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 4,
						dice_sides: 6,
						keep_highest: 3
					}
				},
				id: 3
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('4d6kh3');
			expect(diceResult.result.description).toBe('Rolled 4d6, keeping highest 3');
			expect(diceResult.result.dice).toHaveLength(4);
			
			// Check that only 3 dice are kept
			const keptDice = diceResult.result.dice.filter(die => die.kept);
			expect(keptDice).toHaveLength(3);
		});

		test('reroll specific values', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 3,
						dice_sides: 6,
						reroll: [1]
					}
				},
				id: 4
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('3d6r1');
			expect(diceResult.result.description).toBe('Rolled 3d6, rerolling 1s');
			expect(diceResult.result.dice).toHaveLength(3);
		});

		test('exploding dice', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 2,
						dice_sides: 6,
						exploding: true
					}
				},
				id: 5
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('2d6!');
			expect(diceResult.result.description).toBe('Rolled 2d6, exploding on 6s');
			expect(diceResult.result.dice).toHaveLength(2);
		});

		test('target number counting', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 5,
						dice_sides: 10,
						target_number: 8
					}
				},
				id: 6
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('5d10>=8');
			expect(diceResult.result.description).toBe('Rolled 5d10, counting successes >= 8');
			expect(diceResult.result.total).toBeGreaterThanOrEqual(0);
			expect(diceResult.result.total).toBeLessThanOrEqual(5);
		});

		test('invalid parameters should return error', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 1500, // Invalid: exceeds maximum
						dice_sides: 6
					}
				},
				id: 7
			};

			const response = await sendRequest(request);
			
			// Check that the response indicates an error
			expect(response.error).toBeDefined();
			expect(response.error!.code).toBe(-32602);
			expect(response.error!.message).toContain('Invalid arguments for tool roll_dice');
			expect(response.error!.message).toContain('dice_count');
			expect(response.error!.message).toContain('Number must be less than or equal to 1000');
		});
	});

	describe('roll_multiple tool', () => {
		test('multiple dice rolls', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_multiple',
					arguments: {
						rolls: [
							{ dice_count: 1, dice_sides: 20 },
							{ dice_count: 2, dice_sides: 6 }
						]
					}
				},
				id: 8
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as MultipleRollResponse;

			expect(diceResult.results).toHaveLength(2);
			expect(diceResult.results[0].operation).toBe('1d20');
			expect(diceResult.results[1].operation).toBe('2d6');
			expect(diceResult.results[0].dice).toHaveLength(1);
			expect(diceResult.results[1].dice).toHaveLength(2);
		});

		test('multiple rolls with count', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_multiple',
					arguments: {
						rolls: [
							{ dice_count: 1, dice_sides: 6 }
						],
						count: 3
					}
				},
				id: 9
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as MultipleRollResponse;

			expect(diceResult.results).toHaveLength(3);
			diceResult.results.forEach(result => {
				expect(result.operation).toBe('1d6');
				expect(result.dice).toHaveLength(1);
			});
		});
	});

	describe('server capabilities', () => {
		test('should handle concurrent requests', async () => {
			const requests = [
				{
					jsonrpc: '2.0' as const,
					method: 'tools/call',
					params: {
						name: 'roll_dice',
						arguments: { dice_count: 1, dice_sides: 6 }
					},
					id: 10
				},
				{
					jsonrpc: '2.0' as const,
					method: 'tools/call',
					params: {
						name: 'roll_dice',
						arguments: { dice_count: 1, dice_sides: 20 }
					},
					id: 11
				}
			];

			const responses = await Promise.all(
				requests.map(request => sendRequest(request))
			);

			expect(responses).toHaveLength(2);
			responses.forEach(response => {
				expect(response.jsonrpc).toBe('2.0');
				expect(response.result?.content).toBeDefined();
			});
		});
	});
}); 