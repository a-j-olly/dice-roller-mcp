#!/usr/bin/env node
/**
 * Main entry point for the dice rolling MCP server.
 * This file parses command-line arguments and starts the server
 * with the appropriate transport (stdio or HTTP).
 */
import { startStdioServer } from './transports/stdio.js';
import { logger } from './utils/logging.js';

// Define supported transport types
type TransportType = 'stdio' | 'http';

/**
 * Parse command line arguments to determine transport type
 * @returns The selected transport type (defaults to 'stdio')
 */
function parseTransportType(): TransportType {
	const args = process.argv.slice(2);

	// Look for transport argument
	const transportArg = args.find(
		(arg) =>
			arg.startsWith('--transport=') || arg === '--stdio' || arg === '--http'
	);

	if (!transportArg) {
		return 'stdio'; // Default to stdio if no transport specified
	}

	if (transportArg === '--stdio') {
		return 'stdio';
	}

	if (transportArg === '--http') {
		return 'http';
	}

	// Handle --transport=value format
	const match = transportArg.match(/--transport=(.+)/);
	if (match) {
		const value = match[1].toLowerCase();
		if (value === 'stdio' || value === 'http') {
			return value as TransportType;
		}
	}

	// If we got here, the transport argument is invalid
	logger.warn(`Invalid transport type: ${transportArg}. Defaulting to stdio.`);
	return 'stdio';
}

/**
 * Main function to start the server
 */
async function main() {
	try {
		const transportType = parseTransportType();

		logger.info(`Starting dice rolling server with ${transportType} transport`);

		// Start the server with the selected transport
		switch (transportType) {
			case 'stdio':
				await startStdioServer();
				break;
			case 'http':
				// HTTP transport will be implemented in a future step
				logger.error('HTTP transport not yet implemented');
				process.exit(1);
				break;
		}
	} catch (error) {
		logger.error('Failed to start server', error);
		process.exit(1);
	}
}

// Run the main function
main().catch((error) => {
	logger.error('Unhandled exception', error);
	process.exit(1);
});
