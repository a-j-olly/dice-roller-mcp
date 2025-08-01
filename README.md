# Dice Rolling MCP Server

An MCP (Model Context Protocol) server that provides dice rolling functionality for tabletop RPG sessions. This server gives LLMs secure, controlled access to sophisticated dice rolling operations commonly used in tabletop gaming.

## Features

This server implements two powerful tools for dice rolling:

### Tools

- **`roll_dice`** - Roll dice with advanced modifiers and options
  - Standard rolls (e.g., 3d6, 1d20+5)
  - Keep highest/lowest dice (e.g., 4d6 keep highest 3 for D&D ability scores)
  - Drop highest/lowest dice
  - Reroll specific values (e.g., reroll 1s and 2s)
  - Exploding dice (reroll and add maximum values)
  - Target number counting (count successes above a threshold)
  - Minimum die values

- **`roll_multiple`** - Perform multiple dice rolls in a single operation
  - Batch multiple different roll configurations
  - Repeat the same set of rolls multiple times
  - Ideal for complex scenarios requiring multiple dice operations

### Transports

- **Stdio transport** - Direct process communication for local integrations
- **HTTP/SSE transport** - Network-based communication with rate limiting and CORS support

## Installation

### Using npm

```bash
npm install -g dice-roller-mcp
dice-roller-mcp --help
```

### From Source

```bash
git clone <repository-url>
cd dice-roller-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop

Add this configuration to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "dice-roller": {
      "command": "dice-roller-mcp",
      "args": ["--transport=stdio"]
    }
  }
}
```

### VS Code (via MCP extension)

Add to your VS Code settings.json:

```json
{
  "mcp.servers": {
    "dice-roller": {
      "command": "dice-roller-mcp",
      "args": ["--transport=stdio"]
    }
  }
}
```

### Custom Configuration Options

The server supports flexible command-line arguments:

```bash
# Stdio transport (default)
dice-roller-mcp --transport=stdio

# HTTP transport on default port (3000)
dice-roller-mcp --transport=http

# HTTP transport on custom port
dice-roller-mcp --http --port=8080

# Show help
dice-roller-mcp --help
```

## Usage Examples

### Basic Dice Rolling

```typescript
// Roll 3d6
{
  "dice_count": 3,
  "dice_sides": 6
}

// Roll 1d20 + 5
{
  "dice_count": 1,
  "dice_sides": 20,
  "modifier": 5
}
```

### Advanced Options

```typescript
// D&D ability score generation (4d6, keep highest 3)
{
  "dice_count": 4,
  "dice_sides": 6,
  "keep_highest": 3
}

// Advantage roll (2d20, keep highest)
{
  "dice_count": 2,
  "dice_sides": 20,
  "keep_highest": 1
}

// Exploding dice (common in RPGs like Savage Worlds)
{
  "dice_count": 1,
  "dice_sides": 6,
  "exploding": true
}

// Success counting (Vampire: The Masquerade style)
{
  "dice_count": 5,
  "dice_sides": 10,
  "target_number": 6
}

// Complex combination: 10d10, reroll 1s, explode on 10s, keep highest 3, +15 modifier
{
  "dice_count": 10,
  "dice_sides": 10,
  "reroll": [1],
  "exploding": true,
  "keep_highest": 3,
  "modifier": 15
}
```

### Multiple Rolls

```typescript
{
  "rolls": [
    {
      "dice_count": 1,
      "dice_sides": 20,
      "modifier": 8
    },
    {
      "dice_count": 2,
      "dice_sides": 6,
      "modifier": 3
    }
  ],
  "count": 1
}
```

## Docker

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run

# Or use Docker directly
docker build -t dice-roller-mcp .
docker run -p 3000:3000 dice-roller-mcp
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run coverage
```

### Available Scripts

```bash
npm run build          # Compile TypeScript
npm run start          # Start server (stdio)
npm run start:stdio    # Start with stdio transport
npm run start:http     # Start with HTTP transport
npm run debug          # Start with MCP inspector for debugging
npm run help           # Show command-line help
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