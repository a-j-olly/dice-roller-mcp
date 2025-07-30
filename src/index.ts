#!/usr/bin/env node
/**
 * Main entry point for the dice rolling MCP server.
 * This file parses command-line arguments and starts the server
 * with the appropriate transport (stdio or HTTP).
 */
import { startStdioServer } from './transports/stdio.js';
import { startHttpServer } from './transports/http.js';
import { logger } from './utils/logging.js';

// Define supported transport types
type TransportType = 'stdio' | 'http';

// Configuration interface for parsed command line arguments
interface ServerConfig {
	transport: TransportType;
	port?: number;
	help?: boolean;
}

/**
 * Display help text showing available command line options
 */
function showHelp(): void {
	console.log(`
Dice Rolling MCP Server

Usage: node dice-roller-mcp [options]

Options:
  --transport=<type>    Transport type: 'stdio' or 'http' (default: stdio)
  --stdio               Use stdio transport (same as --transport=stdio)
  --http                Use HTTP transport (same as --transport=http)
  --port=<number>       Port for HTTP transport (default: 3000)
  --help                Show this help message

Examples:
  node dice-roller-mcp                    # Start with stdio transport
  node dice-roller-mcp --http --port=8080 # Start HTTP server on port 8080
  node dice-roller-mcp --transport=http   # Start with HTTP transport on default port
`);
}

/**
 * Parse command line arguments to determine server configuration
 * @returns The parsed server configuration
 */
function parseCommandLineArgs(): ServerConfig {
	const args = process.argv.slice(2);
	const config: ServerConfig = {
		transport: 'stdio', // Default to stdio
	};

	// Check for help flag first
	if (args.includes('--help') || args.includes('-h')) {
		config.help = true;
		return config;
	}

	// Parse transport argument
	const transportArg = args.find(
		(arg) =>
			arg.startsWith('--transport=') || arg === '--stdio' || arg === '--http'
	);

	if (transportArg) {
		if (transportArg === '--stdio') {
			config.transport = 'stdio';
		} else if (transportArg === '--http') {
			config.transport = 'http';
		} else {
			// Handle --transport=value format
			const match = transportArg.match(/--transport=(.+)/);
			if (match) {
				const value = match[1].toLowerCase();
				if (value === 'stdio' || value === 'http') {
					config.transport = value as TransportType;
				} else {
					logger.error(`Invalid transport type: ${value}. Use 'stdio' or 'http'.`);
					process.exit(1);
				}
			}
		}
	}

	// Parse port argument (only relevant for HTTP transport)
	const portArg = args.find(arg => arg.startsWith('--port='));
	if (portArg) {
		const match = portArg.match(/--port=(.+)/);
		if (match) {
			const portValue = parseInt(match[1], 10);
			if (isNaN(portValue) || portValue < 1 || portValue > 65535) {
				logger.error(`Invalid port number: ${match[1]}. Port must be between 1 and 65535.`);
				process.exit(1);
			}
			config.port = portValue;
		}
	}

	// Validate configuration
	if (config.port && config.transport !== 'http') {
		logger.warn('Port argument is only used with HTTP transport. Ignoring --port.');
		config.port = undefined;
	}

	return config;
}

/**
 * Main function to start the server
 */
async function main() {
	try {
		const config = parseCommandLineArgs();

		// Show help and exit if requested
		if (config.help) {
			showHelp();
			process.exit(0);
		}

		logger.info(`Starting dice rolling server with ${config.transport} transport`);
		if (config.transport === 'http' && config.port) {
			logger.info(`HTTP server will use port ${config.port}`);
		}

		// Start the server with the selected transport
		switch (config.transport) {
			case 'stdio':
				await startStdioServer();
				break;
			case 'http':
				await startHttpServer(config.port);
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
