/**
 * Integration tests for the MCP server via stdio transport.
 * Tests the server's JSON-RPC communication over stdin/stdout.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { 
	RollResponse, 
	RollMultipleResponse, 
	McpResponse 
} from '../../../src/dice/types.js';

// Type aliases for test responses
type DiceRollResponse = RollResponse;
type MultipleRollResponse = RollMultipleResponse;

describe('Stdio Transport Integration', () => {
	let serverProcess: ChildProcess;

	beforeEach(async () => {
		// Start the server as a subprocess
		serverProcess = spawn('node', ['build/src/index.js', '--stdio'], {
			stdio: ['pipe', 'pipe', 'pipe']
		});

		// Wait for server to be ready by watching stderr for the ready message
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Server failed to start within 5 seconds'));
			}, 5000);

			serverProcess.stderr!.on('data', (data) => {
				const output = data.toString();
				if (output.includes('Stdio transport created and connected to server')) {
					clearTimeout(timeout);
					resolve();
				}
			});

			serverProcess.on('error', (error) => {
				clearTimeout(timeout);
				reject(error);
			});
		});
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
			let resolved = false;
			
			const timeout = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					reject(new Error('Request timed out'));
				}
			}, 2000); // Reduced from 5000ms to 2000ms

			const onData = (data: Buffer) => {
				if (resolved) return;
				
				try {
					const responseText = data.toString().trim();
					// Handle multiple JSON objects on separate lines
					const lines = responseText.split('\n').filter(line => line.trim());
					
					for (const line of lines) {
						try {
							const response = JSON.parse(line);
							// Make sure this response matches our request ID
							if (response.id === request.id || response.id === null) {
								resolved = true;
								clearTimeout(timeout);
								serverProcess.stdout!.off('data', onData);
								resolve(response);
								return;
							}
						} catch (parseError) {
							// Continue trying other lines
						}
					}
				} catch (error) {
					if (!resolved) {
						resolved = true;
						clearTimeout(timeout);
						serverProcess.stdout!.off('data', onData);
						reject(new Error(`Failed to parse response: ${error}`));
					}
				}
			};

			serverProcess.stdout!.on('data', onData);
			serverProcess.stdin!.write(JSON.stringify(request) + '\n');
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

		test('drop highest dice', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 5,
						dice_sides: 10,
						drop_highest: 2
					}
				},
				id: 7
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('5d10dh2');
			expect(diceResult.result.description).toBe('Rolled 5d10, dropping highest 2');
			expect(diceResult.result.dice).toHaveLength(5);
			
			// Check that only 3 dice are kept (5 - 2 dropped)
			const keptDice = diceResult.result.dice.filter(die => die.kept);
			expect(keptDice).toHaveLength(3);
		});

		test('roll with label', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 1,
						dice_sides: 20,
						modifier: 5,
						label: 'Initiative Roll'
					}
				},
				id: 8
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('1d20+5');
			expect(diceResult.result.description).toBe('Rolled 1d20, adding 5');
			expect(diceResult.result.label).toBe('Initiative Roll');
			expect(diceResult.result.dice).toHaveLength(1);
		});

		test('drop lowest dice', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 4,
						dice_sides: 6,
						drop_lowest: 1
					}
				},
				id: 9
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as DiceRollResponse;

			expect(diceResult.result.operation).toBe('4d6dl1');
			expect(diceResult.result.description).toBe('Rolled 4d6, dropping lowest 1');
			expect(diceResult.result.dice).toHaveLength(4);
			
			// Check that only 3 dice are kept (4 - 1 dropped)
			const keptDice = diceResult.result.dice.filter(die => die.kept);
			expect(keptDice).toHaveLength(3);
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
				id: 9
			};

			const response = await sendRequest(request);
			
			// Check that the response indicates an error
			expect(response.error).toBeDefined();
			expect(response.error!.code).toBe(-32602);
			expect(response.error!.message).toContain('Invalid arguments for tool roll_dice');
			expect(response.error!.message).toContain('dice_count');
			expect(response.error!.message).toContain('Number must be less than or equal to 1000');
		});

		test('conflicting drop and keep parameters should return error', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 4,
						dice_sides: 6,
						keep_highest: 2,
						drop_lowest: 1 // Invalid: can't combine keep and drop
					}
				},
				id: 10
			};

			const response = await sendRequest(request);
			
			// Check that the response contains an error in the content
			expect(response.result).toBeDefined();
			const content = JSON.parse(response.result!.content[0].text);
			expect(content.error).toBeDefined();
			expect(content.error.message).toContain('Invalid parameters');
		});

		test('drop count exceeding dice count should return error', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 3,
						dice_sides: 6,
						drop_highest: 3 // Invalid: can't drop all dice
					}
				},
				id: 11
			};

			const response = await sendRequest(request);
			
			// Check that the response contains an error in the content
			expect(response.result).toBeDefined();
			const content = JSON.parse(response.result!.content[0].text);
			expect(content.error).toBeDefined();
			expect(content.error.message).toContain('Invalid parameters');
		});
	});

	describe('roll_multiple tool', () => {
		test('multiple dice rolls with labels', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				method: 'tools/call',
				params: {
					name: 'roll_multiple',
					arguments: {
						rolls: [
							{ dice_count: 1, dice_sides: 20, modifier: 8, label: 'Attack Roll' },
							{ dice_count: 2, dice_sides: 6, modifier: 3, label: 'Damage Roll' }
						]
					}
				},
				id: 12
			};

			const response = await sendRequest(request);
			const diceResult = extractDiceResult(response) as MultipleRollResponse;

			expect(diceResult.results).toHaveLength(2);
			expect(diceResult.results[0].operation).toBe('1d20+8');
			expect(diceResult.results[0].label).toBe('Attack Roll');
			expect(diceResult.results[1].operation).toBe('2d6+3');
			expect(diceResult.results[1].label).toBe('Damage Roll');
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
				id: 13
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
					id: 14
				},
				{
					jsonrpc: '2.0' as const,
					method: 'tools/call',
					params: {
						name: 'roll_dice',
						arguments: { dice_count: 1, dice_sides: 20 }
					},
					id: 15
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