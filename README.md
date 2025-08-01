# Dice Rolling MCP Server

An MCP (Model Context Protocol) server that provides dice rolling functionality for tabletop RPG sessions. This server gives LLMs secure, controlled access to sophisticated dice rolling operations commonly used in tabletop gaming.

## Features

### Tools

#### `roll_dice`

Roll dice with advanced modifiers and options.

**Parameters:**

- `dice_count` (required): Number of dice to roll (1-1000)
- `dice_sides` (required): Number of sides per die (1-100)
- `modifier` (optional): Number to add/subtract from total
- `keep_highest` (optional): Keep only the N highest dice
- `keep_lowest` (optional): Keep only the N lowest dice  
- `drop_highest` (optional): Drop the N highest dice
- `drop_lowest` (optional): Drop the N lowest dice
- `reroll` (optional): Array of values to reroll (e.g., [1, 2])
- `exploding` (optional): Reroll and add when maximum value is rolled
- `target_number` (optional): Count successes at or above this number
- `min_value` (optional): Minimum value for each die
- `label` (optional): Text label for the roll

**Examples:**

- Standard: `3d6`, `1d20+5`
- D&D Advantage: `2d20kh1` (keep highest)
- Ability Scores: `4d6dl1` (drop lowest)
- Great Weapon Fighting: `2d6r12` (reroll 1s and 2s)
- Exploding Dice: `1d6!` (Savage Worlds style)
- Success Counting: `5d10≥6` (World of Darkness style)

**Example Result:**

```json
{
  "result": {
    "total": 14,
    "dice": [
      {"die": 1, "sides": 6, "rolls": [4], "value": 4, "kept": true, "special": null},
      {"die": 2, "sides": 6, "rolls": [2], "value": 2, "kept": true, "special": null},
      {"die": 3, "sides": 6, "rolls": [5], "value": 5, "kept": true, "special": null}
    ],
    "operation": "3d6+3",
    "description": "Rolled 3d6, adding 3",
    "label": "Initiative Roll"
  },
  "metadata": {
    "parameters": {"dice_count": 3, "dice_sides": 6, "modifier": 3, "label": "Initiative Roll"},
    "timestamp": "2025-08-01T21:07:50.234Z"
  }
}
```

#### `roll_multiple`

Perform multiple dice rolls in a single operation.

**Parameters:**

- `rolls` (required): Array of roll configurations (each using `roll_dice` parameters)
- `count` (optional): Number of times to repeat the entire set

**Use Cases:**

- Attack + damage rolls
- Character generation (multiple ability scores)
- Complex spell effects with multiple components

**Example Result:**

```json
{
  "results": [
    {
      "total": 23,
      "dice": [{"die": 1, "sides": 20, "rolls": [15], "value": 15, "kept": true, "special": null}],
      "operation": "1d20+8",
      "description": "Rolled 1d20, adding 8",
      "label": "Attack Roll"
    },
    {
      "total": 9,
      "dice": [
        {"die": 1, "sides": 6, "rolls": [3], "value": 3, "kept": true, "special": null},
        {"die": 2, "sides": 6, "rolls": [3], "value": 3, "kept": true, "special": null}
      ],
      "operation": "2d6+3",
      "description": "Rolled 2d6, adding 3",
      "label": "Damage Roll"
    }
  ],
  "metadata": {
    "count": 1,
    "total_rolls": 2,
    "timestamp": "2025-08-01T21:07:50.234Z"
  }
}
```

### Transports

- **Stdio transport** - Direct process communication for local integrations
- **HTTP/SSE transport** - Network-based communication with rate limiting and CORS support

## Installation

```bash
git clone <repository-url>
cd dice-roller-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop

#### Stdio Transport (Recommended)

Add this configuration to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "dice-roller": {
      "command": "node",
      "args": ["/path/to/dice-roller-mcp/dist/index.js", "--transport=stdio"],
      "env": {}
    }
  }
}
```

Replace `/path/to/dice-roller-mcp` with the actual path to your installation.

#### Docker Container

For Docker deployment, see the [Docker section](#docker) below. Note that HTTP transport requires additional MCP protocol bridging setup.

### Other MCP Clients

#### Continue (VS Code Extension)

Add to your Continue config file (`~/.continue/config.json`):

```json
{
  "mcpServers": {
    "dice-roller": {
      "command": "node",
      "args": ["/path/to/dice-roller-mcp/dist/index.js", "--transport=stdio"]
    }
  }
}
```

#### Cline (VS Code Extension)

Add to your VS Code settings.json:

```json
{
  "cline.mcpServers": {
    "dice-roller": {
      "command": "node",
      "args": ["/path/to/dice-roller-mcp/dist/index.js", "--transport=stdio"]
    }
  }
}
```

#### Generic MCP Client

For any MCP client that supports stdio transport:

```bash
# Start the server
node /path/to/dice-roller-mcp/dist/index.js --transport=stdio
```

For HTTP transport:

```bash
# Start HTTP server on port 3000
node /path/to/dice-roller-mcp/dist/index.js --transport=http --port=3000

# Connect to: http://localhost:3000/rpc
# SSE endpoint: http://localhost:3000/events
# Health check: http://localhost:3000/health
```


## Usage Examples

### Single Dice Rolls

```json
// Basic roll: 3d6
{"dice_count": 3, "dice_sides": 6}

// With modifier: 1d20+5
{"dice_count": 1, "dice_sides": 20, "modifier": 5}

// D&D ability score: 4d6 drop lowest
{"dice_count": 4, "dice_sides": 6, "drop_lowest": 1}

// Advantage: 2d20 keep highest
{"dice_count": 2, "dice_sides": 20, "keep_highest": 1}

// Exploding dice: 1d6!
{"dice_count": 1, "dice_sides": 6, "exploding": true}

// Success counting: 5d10≥6
{"dice_count": 5, "dice_sides": 10, "target_number": 6}

// With label: Initiative roll
{"dice_count": 1, "dice_sides": 20, "modifier": 3, "label": "Initiative"}
```

### Multiple Rolls

```json
// Attack + Damage
{
  "rolls": [
    {"dice_count": 1, "dice_sides": 20, "modifier": 8, "label": "Attack"},
    {"dice_count": 2, "dice_sides": 6, "modifier": 3, "label": "Damage"}
  ]
}

// Character generation
{
  "rolls": [
    {"dice_count": 4, "dice_sides": 6, "drop_lowest": 1, "label": "Strength"},
    {"dice_count": 4, "dice_sides": 6, "drop_lowest": 1, "label": "Dexterity"},
    {"dice_count": 4, "dice_sides": 6, "drop_lowest": 1, "label": "Constitution"}
  ]
}
```

## Docker

### Quick Start

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run

# Or use Docker directly
docker build -t dice-roller-mcp .
docker run -p 3000:3000 dice-roller-mcp
```

### Docker Commands

```bash
# Build the image
npm run docker:build
# or: docker build -t dice-roller-mcp .

# Run container (foreground)
npm run docker:run
# or: docker run -p 3000:3000 dice-roller-mcp

# Run container (background)
docker run -d -p 3000:3000 --name dice-roller-mcp dice-roller-mcp

# Stop and remove container
docker stop dice-roller-mcp
docker rm dice-roller-mcp

# View container logs
docker logs dice-roller-mcp

# Test the Docker container
npm run docker:test
```

### Docker Image Details

- **Base Image**: Node.js 22 Slim (production-optimized Debian-based)
- **Security**: Runs as non-root user `mcp`
- **Port**: Exposes port 3000 for HTTP transport
- **Size**: ~257MB optimized with multi-stage build
- **Node.js Version**: v22.17.1 (Latest LTS)

### Using the Docker Container

Once the container is running, you can access:

- **JSON-RPC endpoint**: `http://localhost:3000/rpc`
- **Server-Sent Events**: `http://localhost:3000/events`
- **Health check**: `http://localhost:3000/health`

Example API call:

```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "roll_dice",
      "arguments": {
        "dice_count": 2,
        "dice_sides": 6
      }
    },
    "id": 1
  }'
```

## Development


### Available Scripts

```bash
# Build and run
npm run build          # Compile TypeScript  
npm run start          # Start server (stdio transport)
npm run start:http     # Start HTTP transport on port 3000
npm run debug          # Start with MCP inspector for debugging

# Testing
npm test               # Unit + integration tests (no Docker)
npm run test:docker    # Docker integration tests
npm run test:all       # All tests including Docker

# Docker
npm run docker:build   # Build Docker image
npm run docker:run     # Run Docker container
npm run docker:test    # Build and test Docker
```

### Project Structure

```
src/
├── index.ts           # Entry point and transport selection
├── server.ts          # MCP server implementation
├── dice/
│   ├── roll.ts        # Core dice rolling logic
│   ├── types.ts       # TypeScript interfaces
│   └── validation.ts  # Parameter validation
├── transports/
│   ├── stdio.ts       # Stdio transport implementation
│   └── http.ts        # HTTP/SSE transport implementation
└── utils/
    └── logging.ts     # Logging utilities
```

## Debugging

Use the MCP inspector for debugging:

```bash
npm run debug
```

This will start the server with the MCP inspector attached, allowing you to test tools and inspect the protocol communication.

## Security Considerations

- Input validation using Zod schemas prevents malicious parameter injection
- Rate limiting on HTTP transport prevents abuse
- No file system access or external network calls
- All operations are deterministic and safe

## Contributing

Contributions are welcome! This server is part of the Model Context Protocol ecosystem. Please feel free to:

- Report issues
- Submit feature requests
- Contribute code improvements
- Add support for new dice mechanics

## License

MIT