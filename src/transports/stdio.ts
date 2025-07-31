/**
 * Stdio transport implementation for the dice rolling MCP server.
 * This transport allows the server to communicate via standard input/output
 * for direct process communication.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDiceRollingServer } from '../server.js';
import { logger } from '../utils/logging.js';

/**
 * Creates and configures a stdio transport for the dice rolling server.
 * @returns A configured StdioServerTransport connected to the dice rolling server
 */
export function createStdioTransport(): StdioServerTransport {
	try {
		// Create the dice rolling server
		const server = createDiceRollingServer();

		// Configure the stdio transport
		const transport = new StdioServerTransport();

		// Setup error handling for the transport
		transport.onerror = (error) => {
			logger.error('Stdio transport error:', error);
		};

		transport.onclose = () => {
				// Clean exit when transport is closed
			process.exit(0);
		};

		// Connect the server to the transport
		server.connect(transport);

		logger.info('Stdio transport created and connected to server');

		return transport;
	} catch (error) {
		logger.error('Failed to create stdio transport', error);
		throw error;
	}
}

/**
 * Starts the dice rolling server with stdio transport.
 * This function initializes the transport and starts listening for stdin/stdout communication.
 */
export async function startStdioServer(): Promise<void> {
	try {
		const transport = createStdioTransport();


		// Setup signal handlers for graceful shutdown
		process.on('SIGINT', async () => {
			await transport.close();
		});

		process.on('SIGTERM', async () => {
			await transport.close();
		});

		// Since the transport.start() method returns immediately and does not keep the process alive,
		// we need to make sure the process doesn't exit
		process.stdin.resume();
	} catch (error) {
		// Enhanced error output
		logger.error(
			`Failed to start stdio server: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
		if (error instanceof Error && error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
		process.exit(1);
	}
}
