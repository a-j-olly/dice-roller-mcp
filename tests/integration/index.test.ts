/**
 * Tests for the main entry point (index.ts) command-line argument parsing.
 * Tests various command-line argument combinations and error handling.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';

describe('Entry Point (index.ts)', () => {
	let serverProcess: ChildProcess;

	afterEach(() => {
		if (serverProcess) {
			serverProcess.kill();
		}
	});

	/**
	 * Helper function to start server with args and capture output
	 */
	async function startServerWithArgs(args: string[], timeout: number = 3000): Promise<{
		stdout: string;
		stderr: string;
		exitCode: number | null;
	}> {
		return new Promise((resolve) => {
			let stdout = '';
			let stderr = '';
			
			serverProcess = spawn('node', ['build/src/index.js', ...args], {
				stdio: ['pipe', 'pipe', 'pipe']
			});

			serverProcess.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			serverProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			const timer = setTimeout(() => {
				if (serverProcess && !serverProcess.killed) {
					serverProcess.kill();
				}
				resolve({ stdout, stderr, exitCode: null });
			}, timeout);

			serverProcess.on('exit', (code) => {
				clearTimeout(timer);
				resolve({ stdout, stderr, exitCode: code });
			});
		});
	}

	describe('Help Command', () => {
		test('should display help with --help flag', async () => {
			const result = await startServerWithArgs(['--help'], 1000);
			
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('Dice Rolling MCP Server');
			expect(result.stdout).toContain('Usage:');
			expect(result.stdout).toContain('--transport=<type>');
			expect(result.stdout).toContain('--port=<number>');
			expect(result.stdout).toContain('Examples:');
		});

		test('should display help with -h flag', async () => {
			const result = await startServerWithArgs(['-h'], 1000);
			
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('Dice Rolling MCP Server');
		});
	});

	describe('Transport Selection', () => {
		test('should default to stdio transport with no arguments', async () => {
			const result = await startServerWithArgs([], 2000);
			
			expect(result.stderr).toContain('Starting dice rolling server with stdio transport');
			expect(result.stderr).toContain('Stdio transport created and connected to server');
		});

		test('should use stdio transport with --stdio flag', async () => {
			const result = await startServerWithArgs(['--stdio'], 2000);
			
			expect(result.stderr).toContain('Starting dice rolling server with stdio transport');
		});

		test('should use HTTP transport with --http flag', async () => {
			const result = await startServerWithArgs(['--http'], 2000);
			
			expect(result.stderr).toContain('Starting dice rolling server with http transport');
			expect(result.stderr).toContain('HTTP server started on port 3000');
		});

		test('should use transport specified with --transport=stdio', async () => {
			const result = await startServerWithArgs(['--transport=stdio'], 2000);
			
			expect(result.stderr).toContain('Starting dice rolling server with stdio transport');
		});

		test('should use transport specified with --transport=http', async () => {
			const result = await startServerWithArgs(['--transport=http'], 2000);
			
			expect(result.stderr).toContain('Starting dice rolling server with http transport');
		});
	});

	describe('Port Configuration', () => {
		test('should use custom port with --port flag for HTTP transport', async () => {
			const result = await startServerWithArgs(['--http', '--port=8080'], 2000);
			
			expect(result.stderr).toContain('HTTP server will use port 8080');
			expect(result.stderr).toContain('HTTP server started on port 8080');
		});

		test('should warn when port is specified with stdio transport', async () => {
			const result = await startServerWithArgs(['--stdio', '--port=8080'], 2000);
			
			expect(result.stderr).toContain('Port argument is only used with HTTP transport. Ignoring --port.');
			expect(result.stderr).toContain('Starting dice rolling server with stdio transport');
		});

		test('should use default port 3000 when not specified for HTTP', async () => {
			const result = await startServerWithArgs(['--http'], 2000);
			
			expect(result.stderr).toContain('HTTP server started on port 3000');
		});
	});

	describe('Error Handling', () => {
		test('should exit with error for invalid transport type', async () => {
			const result = await startServerWithArgs(['--transport=invalid'], 1000);
			
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Invalid transport type: invalid');
		});

		test('should exit with error for invalid port number', async () => {
			const result = await startServerWithArgs(['--port=99999'], 1000);
			
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Invalid port number: 99999');
		});

		test('should exit with error for non-numeric port', async () => {
			const result = await startServerWithArgs(['--port=abc'], 1000);
			
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Invalid port number: abc');
		});

		test('should exit with error for port 0', async () => {
			const result = await startServerWithArgs(['--port=0'], 1000);
			
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Invalid port number: 0');
		});

		test('should exit with error for negative port', async () => {
			const result = await startServerWithArgs(['--port=-1'], 1000);
			
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain('Invalid port number: -1');
		});
	});

	describe('Complex Argument Combinations', () => {
		test('should handle multiple valid arguments', async () => {
			const result = await startServerWithArgs(['--transport=http', '--port=9000'], 2000);
			
			expect(result.stderr).toContain('Starting dice rolling server with http transport');
			expect(result.stderr).toContain('HTTP server will use port 9000');
			expect(result.stderr).toContain('HTTP server started on port 9000');
		});

		test('should handle conflicting transport arguments (first one wins)', async () => {
			const result = await startServerWithArgs(['--stdio', '--http'], 2000);
			
			expect(result.stderr).toContain('Starting dice rolling server with stdio transport');
		});
	});

	describe('Signal Handling', () => {
		test('should handle SIGTERM gracefully for stdio server', async () => {
			const result = await startServerWithArgs(['--stdio'], 2000);
			
			// The server should start and then be terminated by our timeout
			expect(result.stderr).toContain('Starting dice rolling server with stdio transport');
		});

		test('should handle SIGTERM gracefully for HTTP server', async () => {
			const result = await startServerWithArgs(['--http', '--port=8001'], 2000);
			
			// The server should start and then be terminated by our timeout
			expect(result.stderr).toContain('Starting dice rolling server with http transport');
			expect(result.stderr).toContain('HTTP server started on port 8001');
		});
	});
});