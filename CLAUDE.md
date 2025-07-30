# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides dice rolling functionality for tabletop RPG sessions. The server supports both stdio and HTTP/SSE transports and implements two main tools: `roll_dice` and `roll_multiple`.

## Common Commands

### Build and Run
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start the server (defaults to stdio transport)
- `npm run start:stdio` - Start with stdio transport for direct process communication
- `npm run start:http` - Start with HTTP/SSE transport on port 3000
- `npm run start:http:8080` - Start with HTTP/SSE transport on port 8080
- `npm run help` - Show command-line help

### Command Line Options
The server supports flexible command-line arguments:
- `--transport=<type>` or `--stdio`/`--http` - Choose transport type
- `--port=<number>` - Specify port for HTTP transport (default: 3000)
- `--help` - Display help information

Examples:
- `node build/src/index.js --http --port=8080`
- `node build/src/index.js --transport=stdio`

### Testing
- `npm test` - Run all tests (unit + integration)
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:watch` - Run all tests in watch mode
- `npm run test:watch:unit` - Run unit tests in watch mode
- `npm run test:watch:integration` - Run integration tests in watch mode
- `npm run coverage` - Run tests with coverage report
- `npm run coverage` - Run tests with coverage report

### Docker
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run server in Docker container on port 3000

## Architecture

### Core Components

**Entry Point (`src/index.ts`)**:
- Parses command-line arguments to select transport type (stdio or HTTP)
- Delegates to appropriate transport startup function

**MCP Server (`src/server.ts`)**:
- Creates the MCP server instance using `@modelcontextprotocol/sdk`
- Defines and implements the `roll_dice` and `roll_multiple` tools
- Handles parameter validation and error responses
- Uses Zod schemas for type validation

**Transport Layer**:
- **Stdio Transport (`src/transports/stdio.ts`)**: Direct process communication via stdin/stdout
- **HTTP Transport (`src/transports/http.ts`)**: Fastify-based HTTP server with SSE support, rate limiting, and JSON-RPC endpoints

**Dice Logic (`src/dice/`)**:
- `roll.ts`: Core dice rolling implementation with support for modifiers, keep highest/lowest, rerolls, exploding dice, target numbers
- `validation.ts`: Zod-based parameter validation
- `types.ts`: TypeScript interfaces for all dice rolling operations and responses

### Key Design Patterns

- **Transport Abstraction**: The MCP server is transport-agnostic; different transports (stdio, HTTP) can be plugged in
- **Validation Pipeline**: All inputs are validated using Zod schemas before processing
- **Error Handling**: Consistent error response format across both tools
- **Rate Limiting**: HTTP transport includes rate limiting and client connection management

### Testing Strategy

- Uses Vitest as the test framework
- **Unit Tests** (`tests/unit/`) - Fast, isolated tests for individual components:
  - `tests/unit/dice/` - Dice rolling logic and validation
  - `tests/unit/utils/` - Utility functions like logging
- **Integration Tests** (`tests/integration/`) - End-to-end tests for complete functionality:
  - `tests/integration/transports/stdio-transport.test.ts` - Stdio transport
  - `tests/integration/transports/http-transport.test.ts` - HTTP/SSE transport
  - `tests/integration/index.test.ts` - Entry point and command-line parsing

### Configuration Files

- `tsconfig.json`: TypeScript configuration with ES2022 target and NodeNext modules
- `vitest.config.ts`: Test configuration with Node.js environment and coverage reporting
- `package.json`: Defines all npm scripts and dependencies

### Dependencies

**Runtime**:
- `@modelcontextprotocol/sdk`: Core MCP functionality
- `fastify` + `@fastify/cors`: HTTP server for HTTP transport
- `zod`: Runtime type validation

**Development**:
- `typescript`: TypeScript compiler
- `vitest`: Testing framework
- `@types/node`: Node.js type definitions