/**
 * Integration tests for the Docker container.
 * Tests the HTTP server running in a Docker container.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execSync } from 'child_process';

// Check Docker availability at module level for proper test skipping
let dockerAvailable = false;

try {
	execSync('docker --version', { stdio: 'ignore' });
	execSync('docker info', { stdio: 'ignore' });
	dockerAvailable = true;
} catch {
	dockerAvailable = false;
}

describe('Docker Container Integration', () => {
	let containerId: string;
	const testPort = 9999; // Use a different port to avoid conflicts


	beforeAll(async () => {
		if (!dockerAvailable) return;

		// Check if image already exists, build if needed
		try {
			await execCommand('docker image inspect dice-roller-mcp');
		} catch {
			await execCommandWithProgress('npm run docker:build', 'Building Docker image');
		}

		// Start container
		const result = await execCommandWithProgress(
			`docker run -d -p ${testPort}:3000 dice-roller-mcp`,
			'Starting container'
		);
		containerId = result.trim();

		await waitForContainer(testPort);
	}, 120000);

	afterAll(async () => {
		if (containerId) {
			await execCommand(`docker stop ${containerId}`);
			await execCommand(`docker rm ${containerId}`);
		}
	});

	function execCommand(command: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const process = spawn('sh', ['-c', command]);
			let stdout = '';
			let stderr = '';

			process.stdout.on('data', (data) => stdout += data.toString());
			process.stderr.on('data', (data) => stderr += data.toString());
			process.on('close', (code) => {
				code === 0 
					? resolve(stdout) 
					: reject(new Error(`Command failed: ${command}\n${stderr}`));
			});
		});
	}

	function execCommandWithProgress(command: string, description: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();
			const process = spawn('sh', ['-c', command]);
			let stdout = '';
			let stderr = '';

			process.stdout.on('data', (data) => stdout += data.toString());
			process.stderr.on('data', (data) => stderr += data.toString());
			process.on('close', (code) => {
				const duration = ((Date.now() - startTime) / 1000).toFixed(1);
				code === 0
					? resolve(stdout)
					: reject(new Error(`${description} failed after ${duration}s: ${command}\n${stderr}`));
			});

			// 90 second timeout for Docker operations
			setTimeout(() => {
				const duration = ((Date.now() - startTime) / 1000).toFixed(1);
				process.kill();
				reject(new Error(`${description} timed out after ${duration}s`));
			}, 90000);
		});
	}

	async function waitForContainer(port: number, maxAttempts = 30): Promise<void> {
		for (let i = 0; i < maxAttempts; i++) {
			try {
				const response = await fetch(`http://localhost:${port}/health`);
				if (response.ok) return;
			} catch {
				// Container not ready, continue trying
			}
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		throw new Error('Container failed to start within timeout period');
	}

	async function makeHttpRequest(endpoint: string, method = 'GET', body?: any): Promise<Response> {
		return fetch(`http://localhost:${testPort}${endpoint}`, {
			method,
			headers: { 'Content-Type': 'application/json' },
			...(body && { body: JSON.stringify(body) })
		});
	}


	describe('Container Health & Logging', () => {
		test.skipIf(!dockerAvailable)('should have healthy endpoints and clean startup logs', async () => {
			// Verify health endpoint
			const healthResponse = await makeHttpRequest('/health');
			expect(healthResponse.status).toBe(200);
			expect(healthResponse.headers.get('content-type')).toContain('application/json');
			
			const healthData = await healthResponse.json();
			expect(healthData.status).toBe('ok');
			expect(healthData.timestamp).toBeDefined();
			expect(typeof healthData.timestamp).toBe('string');

			// Verify clean startup logs
			const logs = await execCommand(`docker logs ${containerId} 2>&1`);
			expect(logs).toContain('Starting dice rolling server');
			expect(logs).toContain('HTTP server started');
			expect(logs).not.toContain('ERROR');
			expect(logs).not.toContain('FATAL');
		});
	});

	describe('Dice Rolling API', () => {
		test.skipIf(!dockerAvailable)('should handle basic JSON-RPC dice requests', async () => {
			const request = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: { dice_count: 2, dice_sides: 6, modifier: 3 }
				},
				id: 'basic-roll'
			};

			const response = await makeHttpRequest('/rpc', 'POST', request);
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toContain('application/json');
			
			const data = await response.json();
			expect(data.jsonrpc).toBe('2.0');
			expect(data.id).toBe('basic-roll');
			expect(data.result?.content?.[0]?.text).toBeDefined();

			const result = JSON.parse(data.result.content[0].text);
			expect(result.result.operation).toBe('2d6+3');
			expect(result.result.total).toBeGreaterThanOrEqual(5);
			expect(result.result.total).toBeLessThanOrEqual(15);
			expect(result.result.dice).toHaveLength(2);
		});

		test.skipIf(!dockerAvailable)('should handle advanced features and batch operations', async () => {
			await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
			
			// Test advanced dice features
			const advancedRequest = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_dice',
					arguments: { dice_count: 4, dice_sides: 6, keep_highest: 3, label: 'Ability Score' }
				},
				id: 'advanced-roll'
			};

			const advancedResponse = await makeHttpRequest('/rpc', 'POST', advancedRequest);
			expect(advancedResponse.status).toBe(200);

			const advancedData = await advancedResponse.json();
			const advancedResult = JSON.parse(advancedData.result.content[0].text);
			
			expect(advancedResult.result.operation).toBe('4d6kh3');
			expect(advancedResult.result.label).toBe('Ability Score');
			expect(advancedResult.result.dice).toHaveLength(4);
			
			const keptDice = advancedResult.result.dice.filter((die: any) => die.kept);
			expect(keptDice).toHaveLength(3);

			await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
			
			// Test multiple rolls
			const multiRequest = {
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: 'roll_multiple',
					arguments: {
						rolls: [
							{ dice_count: 1, dice_sides: 20, modifier: 5, label: 'Attack' },
							{ dice_count: 1, dice_sides: 8, modifier: 2, label: 'Damage' }
						]
					}
				},
				id: 'multi-roll'
			};

			const multiResponse = await makeHttpRequest('/rpc', 'POST', multiRequest);
			expect(multiResponse.status).toBe(200);
			
			const multiData = await multiResponse.json();
			const multiResult = JSON.parse(multiData.result.content[0].text);
			
			expect(multiResult.results).toHaveLength(2);
			expect(multiResult.results[0].operation).toBe('1d20+5');
			expect(multiResult.results[0].label).toBe('Attack');
			expect(multiResult.results[1].operation).toBe('1d8+2');
			expect(multiResult.results[1].label).toBe('Damage');
		});
	});

	describe('Container Security & Configuration', () => {
		test.skipIf(!dockerAvailable)('should run securely with proper configuration', async () => {
			// Verify non-root user
			const userResult = await execCommand(`docker exec ${containerId} whoami`);
			expect(userResult.trim()).toBe('mcp');
			
			// Verify port configuration
			const portResult = await execCommand(`docker port ${containerId}`);
			expect(portResult).toContain('3000/tcp');
			expect(portResult).toContain(`0.0.0.0:${testPort}`);
			
			// Verify container state
			const inspectResult = await execCommand(`docker inspect ${containerId} --format '{{.State.Running}}'`);
			expect(inspectResult.trim()).toBe('true');
		});
	});

	describe('Container Performance', () => {
		test.skipIf(!dockerAvailable)('should handle sequential requests efficiently', async () => {
			await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
			
			const requests = Array.from({ length: 3 }, (_, i) => ({
				jsonrpc: '2.0',
				method: 'tools/call',
				params: { name: 'roll_dice', arguments: { dice_count: 1, dice_sides: 6 } },
				id: `perf-${i + 1}`
			}));

			// Make sequential requests with rate limiting
			const startTime = Date.now();
			const responses: Response[] = [];
			for (const request of requests) {
				const response = await makeHttpRequest('/rpc', 'POST', request);
				responses.push(response);
				if (responses.length < requests.length) {
					await new Promise(resolve => setTimeout(resolve, 250));
				}
			}
			const duration = Date.now() - startTime;

			// Verify all requests succeeded
			responses.forEach(response => expect(response.status).toBe(200));

			// Verify valid JSON-RPC responses
			const results = await Promise.all(responses.map(r => r.json()));
			results.forEach((data: any, i: number) => {
				expect(data.jsonrpc).toBe('2.0');
				expect(data.id).toBe(`perf-${i + 1}`);
				expect(data.result?.content?.[0]?.text).toBeDefined();
			});

			// Performance check
			expect(duration).toBeLessThan(3000);
		});
	});
});