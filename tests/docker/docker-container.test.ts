/**
 * Integration tests for the Docker container.
 * Tests the HTTP server running in a Docker container.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

describe('Docker Container Integration', () => {
	let containerProcess: ChildProcess;
	let containerId: string;
	const testPort = 9999; // Use a different port to avoid conflicts

	beforeAll(async () => {
		// Build the Docker image
		console.log('Building Docker image...');
		await execCommand('npm run docker:build');

		// Start container in detached mode
		console.log('Starting Docker container...');
		const result = await execCommand(`docker run -d -p ${testPort}:3000 dice-roller-mcp`);
		containerId = result.trim();

		// Wait for container to be ready
		await waitForContainer(testPort);
	}, 60000); // 60 second timeout for build and startup

	afterAll(async () => {
		if (containerId) {
			console.log('Stopping Docker container...');
			await execCommand(`docker stop ${containerId}`);
			await execCommand(`docker rm ${containerId}`);
		}
	});

	/**
	 * Helper function to execute shell commands
	 */
	function execCommand(command: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const process = spawn('sh', ['-c', command]);
			let stdout = '';
			let stderr = '';

			process.stdout.on('data', (data) => {
				stdout += data.toString();
			});

			process.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			process.on('close', (code) => {
				if (code === 0) {
					resolve(stdout);
				} else {
					reject(new Error(`Command failed: ${command}\n${stderr}`));
				}
			});
		});
	}

	/**
	 * Helper function to wait for container to be ready
	 */
	async function waitForContainer(port: number, maxAttempts: number = 30): Promise<void> {
		for (let i = 0; i < maxAttempts; i++) {
			try {
				const response = await fetch(`http://localhost:${port}/health`);
				if (response.ok) {
					console.log('Container is ready!');
					return;
				}
			} catch (error) {
				// Container not ready yet, wait and retry
			}
			
			await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
		}
		
		throw new Error('Container failed to start within timeout period');
	}

	/**
	 * Helper function to make HTTP requests to the containerized server
	 */
	async function makeHttpRequest(endpoint: string, method: string = 'GET', body?: any): Promise<Response> {
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

		return fetch(url, options);
	}

	describe('Container Health', () => {
		test('should respond to health check', async () => {
			const response = await makeHttpRequest('/health');
			
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toContain('application/json');
			
			const data = await response.json();
			expect(data.status).toBe('ok');
			expect(data.timestamp).toBeDefined();
		});

		test('should check container logs', async () => {
			// Wait a bit for logs to be available
			await new Promise(resolve => setTimeout(resolve, 2000));
			const logs = await execCommand(`docker logs ${containerId} 2>&1`);
			
			expect(logs).toContain('Starting dice rolling server');
			expect(logs).toContain('HTTP server started');
		});
	});

	describe('Dice Rolling API', () => {
		test('should handle basic dice roll via container', async () => {
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 3,
						dice_sides: 6,
						modifier: 2
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
			expect(diceResult.result.total).toBeGreaterThanOrEqual(5); // 3 + 2 minimum
			expect(diceResult.result.total).toBeLessThanOrEqual(20); // 18 + 2 maximum
			expect(diceResult.result.operation).toBe('3d6+2');
			expect(diceResult.result.dice).toHaveLength(3);
		});

		test('should handle advanced dice features via container', async () => {
			// Wait to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 4,
						dice_sides: 6,
						keep_highest: 3,
						label: 'Container Test Roll'
					}
				},
				id: 2
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			const diceResult = JSON.parse(data.result.content[0].text);
			
			expect(diceResult.result.operation).toBe('4d6kh3');
			expect(diceResult.result.label).toBe('Container Test Roll');
			expect(diceResult.result.dice).toHaveLength(4);
			
			// Check that only 3 dice are kept
			const keptDice = diceResult.result.dice.filter((die: any) => die.kept);
			expect(keptDice).toHaveLength(3);
		});

		test('should handle multiple rolls via container', async () => {
			// Wait to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_multiple',
					arguments: {
						rolls: [
							{ dice_count: 1, dice_sides: 20, modifier: 5, label: 'Attack Roll' },
							{ dice_count: 2, dice_sides: 6, modifier: 3, label: 'Damage Roll' }
						]
					}
				},
				id: 3
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			
			expect(response.status).toBe(200);
			const data = await response.json();
			const diceResult = JSON.parse(data.result.content[0].text);
			
			expect(diceResult.results).toHaveLength(2);
			expect(diceResult.results[0].operation).toBe('1d20+5');
			expect(diceResult.results[0].label).toBe('Attack Roll');
			expect(diceResult.results[1].operation).toBe('2d6+3');
			expect(diceResult.results[1].label).toBe('Damage Roll');
		});
	});

	describe('Container Security', () => {
		test('should run as non-root user', async () => {
			const result = await execCommand(`docker exec ${containerId} whoami`);
			expect(result.trim()).toBe('mcp');
		});

		test('should expose only the configured port', async () => {
			const result = await execCommand(`docker port ${containerId}`);
			expect(result).toContain('3000/tcp');
		});
	});

	describe('Container Performance', () => {
		test('should handle sequential requests', async () => {
			// Wait to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			const requests = Array.from({ length: 3 }, (_, i) => ({
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: {
						dice_count: 2,
						dice_sides: 6,
						label: `Sequential Roll ${i + 1}`
					}
				},
				id: i + 1
			}));

			// Make requests sequentially with delays to avoid rate limiting
			const responses = [];
			for (const request of requests) {
				const response = await makeHttpRequest('/rpc', 'POST', request);
				responses.push(response);
				await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between requests
			}

			responses.forEach((response, i) => {
				expect(response.status).toBe(200);
			});

			// Verify all responses are valid
			const results = await Promise.all(
				responses.map(response => response.json())
			);

			results.forEach((data, i) => {
				expect(data.jsonrpc).toBe('2.0');
				expect(data.id).toBe(i + 1);
				expect(data.result).toBeDefined();
			});
		});
	});
});