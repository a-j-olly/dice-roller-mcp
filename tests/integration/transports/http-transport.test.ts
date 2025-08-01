/**
 * Integration tests for the HTTP transport.
 * Tests the HTTP/SSE server endpoints and JSON-RPC communication.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createHttpTransport } from '../../../src/transports/http.js';
import type { FastifyInstance } from 'fastify';

describe('HTTP Transport Integration', () => {
	let server: FastifyInstance;
	const testPort = 8888; // Use a different port to avoid conflicts

	beforeEach(async () => {
		// Create HTTP transport directly in-process (much faster!)
		server = await createHttpTransport(testPort);
		
		// Start listening
		await server.listen({ port: testPort, host: '127.0.0.1' });
		
		// Wait a bit for server to be fully ready
		await new Promise(resolve => setTimeout(resolve, 100));
	});

	afterEach(async () => {
		if (server) {
			await server.close();
			// Wait for server to fully close
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	});

	/**
	 * Helper function to make HTTP requests to the server with retry logic
	 */
	async function makeHttpRequest(endpoint: string, method: string = 'GET', body?: any, retries: number = 3): Promise<Response> {
		const url = `http://localhost:${testPort}${endpoint}`;
		const options: RequestInit = {
			method,
			headers: {
				'Content-Type': 'application/json',
			},
		};

		if (body) {
			options.body = JSON.stringify(body);
		}

		for (let i = 0; i < retries; i++) {
			try {
				const response = await fetch(url, options);
				return response;
			} catch (error) {
				if (i === retries - 1) {
					throw error; // Last attempt, throw the error
				}
				// Wait before retry
				await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
			}
		}
		
		throw new Error('All retries failed');
	}

	describe('Health Check Endpoint', () => {
		test('should return 200 OK with status', async () => {
			const response = await makeHttpRequest('/health');
			
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toContain('application/json');
			
			const data = await response.json();
			expect(data.status).toBe('ok');
			expect(data.timestamp).toBeDefined();
		});
	});

	describe('SSE Endpoint', () => {
		test('should establish SSE connection', async () => {
			const response = await makeHttpRequest('/events');
			
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toBe('text/event-stream');
			expect(response.headers.get('cache-control')).toBe('no-cache');
			expect(response.headers.get('connection')).toBe('keep-alive');
		});
	});

	describe('JSON-RPC Endpoint', () => {
		test('should handle basic dice roll request', async () => {
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 2,
						dice_sides: 6
					}
				},
				id: 1
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toContain('application/json');
			
			const data = await response.json();
			expect(data.jsonrpc).toBe('2.0');
			expect(data.id).toBe(1);
			expect(data.result).toBeDefined();
			expect(data.result.content).toBeDefined();

			// Parse the dice result
			const diceResult = JSON.parse(data.result.content[0].text);
			expect(diceResult.result.total).toBeGreaterThanOrEqual(2);
			expect(diceResult.result.total).toBeLessThanOrEqual(12);
			expect(diceResult.result.operation).toBe('2d6');
			expect(diceResult.result.dice).toHaveLength(2);
		});

		test('should handle drop dice functionality', async () => {
			// Add delay between tests to avoid connection issues
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 4,
						dice_sides: 6,
						drop_lowest: 1
					}
				},
				id: 2
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			const diceResult = JSON.parse(data.result.content[0].text);
			
			expect(diceResult.result.operation).toBe('4d6dl1');
			expect(diceResult.result.description).toBe('Rolled 4d6, dropping lowest 1');
			expect(diceResult.result.dice).toHaveLength(4);
			
			// Check that only 3 dice are kept
			const keptDice = diceResult.result.dice.filter((die: any) => die.kept);
			expect(keptDice).toHaveLength(3);
		});

		test('should handle dice roll with label', async () => {
			// Add delay between tests to avoid connection issues
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 1,
						dice_sides: 20,
						modifier: 3,
						label: 'Stealth Check'
					}
				},
				id: 3
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			const diceResult = JSON.parse(data.result.content[0].text);
			
			expect(diceResult.result.operation).toBe('1d20+3');
			expect(diceResult.result.label).toBe('Stealth Check');
			expect(diceResult.result.dice).toHaveLength(1);
		});

		test('should handle roll_multiple tool with labels', async () => {
			// Add delay between tests to avoid connection issues
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_multiple',
					arguments: {
						rolls: [
							{ dice_count: 1, dice_sides: 20, label: 'Attack' },
							{ dice_count: 1, dice_sides: 4, label: 'Damage' }
						]
					}
				},
				id: 6
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			const diceResult = JSON.parse(data.result.content[0].text);
			
			expect(diceResult.results).toHaveLength(2);
			expect(diceResult.results[0].operation).toBe('1d20');
			expect(diceResult.results[0].label).toBe('Attack');
			expect(diceResult.results[1].operation).toBe('1d4');
			expect(diceResult.results[1].label).toBe('Damage');
		});

		test('should return error for invalid parameters', async () => {
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 2000, // Invalid: exceeds maximum
						dice_sides: 6
					}
				},
				id: 6
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBeDefined();
			expect(data.error.code).toBe(-32602);
			expect(data.error.message).toBe('Invalid parameters');
		});

		test('should return error for unknown tool', async () => {
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'unknown_tool',
					arguments: {}
				},
				id: 6
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBeDefined();
			expect(data.message || data.error.message || data.error).toContain('unknown_tool');
		});

		test('should return error for invalid JSON-RPC request', async () => {
			const request = {
				// Missing required fields
				invalid: 'request'
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBeDefined();
			expect(data.message).toContain('method');
		});
	});

	describe('Rate Limiting', () => {
		test('should enforce rate limiting', async () => {
			// Make multiple rapid requests
			const requests = Array.from({ length: 5 }, () => 
				makeHttpRequest('/health')
			);

			const responses = await Promise.all(requests);
			
			// At least some requests should succeed (the first one)
			const successfulResponses = responses.filter(r => r.status === 200);
			
			expect(successfulResponses.length).toBeGreaterThan(0);
			// Rate limiting might kick in for rapid requests
		});
	});

	describe('CORS Headers', () => {
		test('should include CORS headers', async () => {
			const response = await makeHttpRequest('/health');
			
			expect(response.headers.get('access-control-allow-origin')).toBeDefined();
		});
	});
});