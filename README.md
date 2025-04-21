# Dice Rolling MCP Server

An MCP (Model Context Protocol) server that provides dice rolling functionality to support LLM agents assisting with tabletop RPG sessions.

## Overview

This server implements the Model Context Protocol to provide structured dice rolling capabilities for tabletop RPG systems like D&D, Pathfinder, Call of Cthulhu, and others. It can be used by LLM agents to perform various dice operations including:

- Standard dice rolls (e.g., 3d6, 1d20+5)
- Keep highest/lowest dice (e.g., 4d6 keep highest 3 for D&D ability scores)
- Rerolling specific values (e.g., 3d6 reroll 1s)
- Exploding dice (reroll and add maximum values)
- Target number counting (count successes above a threshold)
- Setting minimum die values

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dice-rolling-server-mcp.git
cd dice-rolling-server-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Starting the Server

The server supports both stdio and HTTP/SSE transports:

```bash
# Start with stdio transport (for direct process communication)
npm run start:stdio

# Start with HTTP/SSE transport (for network communication)
npm run start:http
```

### Docker Support

```bash
# Build Docker image
npm run docker:build

# Run with Docker
npm run docker:run
```

## API

The server exposes two main tools through the MCP protocol:

### 1. roll_dice

Roll dice according to specified parameters and return detailed results.

### 2. roll_multiple

Perform multiple dice rolls in a single batch operation.

See the full API documentation in the LLM Integration Guide section below.

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## LLM Integration Guide

(Complete documentation for LLM integration will be added here)

## License

MIT