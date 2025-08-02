# Dice Rolling MCP Server

Have you ever wondered whether your favorite AI assistant is *really* rolling random dice?

This tool adds reliable dice rolling capabilities to AI assistants. Perfect for tabletop RPG sessions, this server is suitable for a broad set of gaming rules.

## What This Does

This tool lets AI assistants roll dice for you with support for:

- **Standard rolls**: `3d6`, `1d20+5`
- **TTRPG mechanics**: Advantage (2d20kh1, roll twice, keep highest), ability scores generation (4d6dl1, drop lowest)
- **Advanced features**: Exploding dice, rerolls, success counting, keep/drop highest/lowest
- **Multiple rolls**: Attack + damage, character generation, horde attack rolls

## Quick Setup

### Step 1: Install

**Recommended - No installation needed:**

Configure you AI assistant to use npx to automatically download and run the latest version (move to step 2). This ensures you always have the most recent version without manual updates.

**Alternative - Global installation:**

```bash
npm install -g dice-roller-mcp
```

Use this if you want slightly faster startup times.

**Developers only** (if you want to modify the code):

```bash
git clone https://github.com/a-j-olly/dice-roller-mcp
cd dice-roller-mcp
npm install
npm run build
```

### Step 2: Configure Your AI Assistant

#### Claude Desktop

Find your config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Recommended configuration (using npx):**

```json
{
  "mcpServers": {
    "dice-roller": {
      "command": "npx",
      "args": ["dice-roller-mcp"]
    }
  }
}
```

**If you installed globally:**

```json
{
  "mcpServers": {
    "dice-roller": {
      "command": "dice-roller-mcp"
    }
  }
}
```

**If you cloned the repository:**

```json
{
  "mcpServers": {
    "dice-roller": {
      "command": "node",
      "args": ["/path/to/dice-roller-mcp/dist/index.js"]
    }
  }
}
```

#### Other AI Assistants

**Continue (VS Code extension)** - Add to `~/.continue/config.json`:

```json
{
  "mcpServers": {
    "dice-roller": {
      "command": "npx",
      "args": ["dice-roller-mcp"]
    }
  }
}
```

**Cline (VS Code extension)** - Add to VS Code settings.json:

```json
{
  "cline.mcpServers": {
    "dice-roller": {
      "command": "npx",
      "args": ["dice-roller-mcp"]
    }
  }
}
```

### Step 3: Restart Your AI Assistant

Restart Claude Desktop or your VS Code extension to load the dice roller.

## How to Use

Once configured, ask your AI assistant to roll dice:

- *"Roll me a D&D 5e player character"*
- *"Roll 2d20 keep highest for advantage"*
- *"Roll 5d10 and count successes of 6 or higher"*
- *"Roll initiative for the party"*
- *"Roll 4d6 drop lowest for ability scores"*
- *"Roll exploding d6s for damage"*
- *"Make a group luck roll"*
- *"Roll 3d6+5 and reroll any 1s"*

## Available Dice Features

### Basic Rolling

- **Simple rolls**: Any number of dice with any number of sides
- **Modifiers**: Add or subtract numbers from the total
- **Labels**: Name your rolls ("Attack Roll", "Damage", etc.)

### Advanced Mechanics

- **Keep/Drop**: Keep or drop the highest/lowest dice
- **Rerolls**: Reroll specific values (Great Weapon Fighting in D&D)
- **Exploding dice**: When you roll the maximum, roll again and add
- **Success counting**: Count how many dice meet a target number
- **Minimum values**: Set a floor for individual dice

### Multiple Rolls

Roll several different dice at once:

- Attack roll + damage roll
- All six ability scores for character creation
- Complex spell effects with multiple components

## Docker (Advanced Users)

Docker deployment is ideal for:

- Production environments
- Containerized infrastructure
- Web-based integrations requiring HTTP transport
- Isolated testing environments

### Quick Start

```bash
# Clone repository (required for Docker)
git clone <repository-url>
cd dice-roller-mcp

# Build and run with npm scripts
npm run docker:build
npm run docker:run

# Or use Docker directly
docker build -t dice-roller-mcp .
docker run -p 3000:3000 dice-roller-mcp
```

### Docker Commands

**Building:**

```bash
# Using npm script (recommended)
npm run docker:build

# Using Docker directly
docker build -t dice-roller-mcp .
```

**Running:**

```bash
# Foreground (logs visible)
npm run docker:run
# or: docker run -p 3000:3000 dice-roller-mcp

# Background (detached)
docker run -d -p 3000:3000 --name dice-roller dice-roller-mcp

# Custom port
docker run -p 8080:3000 dice-roller-mcp
```

**Management:**

```bash
# View logs
docker logs dice-roller

# Stop container
docker stop dice-roller

# Remove container
docker rm dice-roller

# Remove image
docker rmi dice-roller-mcp
```

### Docker Image Details

- **Base**: Node.js 22 Slim (Debian-based, production-optimized)
- **Size**: ~257MB (multi-stage build optimized)
- **Security**: Runs as non-root user `mcp`
- **Port**: Exposes 3000 (HTTP transport only)
- **Environment**: Production Node.js environment

### Using the Container

Once running, the container provides HTTP endpoints:

```bash
# Health check
curl http://localhost:3000/health

# JSON-RPC API
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

# Server-Sent Events (for real-time updates)
curl http://localhost:3000/events
```

### Docker Compose

For production deployments, create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  dice-roller:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with: `docker-compose up -d`

### Integration with MCP Clients

**Note**: Docker containers use HTTP transport, which requires additional setup for most MCP clients. The stdio transport (used by Claude Desktop and VS Code extensions) doesn't work directly with Docker containers.

For HTTP-based integrations, connect to:

- **JSON-RPC endpoint**: `http://localhost:3000/rpc`
- **Server-Sent Events**: `http://localhost:3000/events`
- **Health check**: `http://localhost:3000/health`

### Testing Docker

```bash
# Run all tests (builds image if needed)
npm run docker:test

# Manual testing
docker run --rm dice-roller-mcp npm test
```

## For Developers

### Development Commands

```bash
npm run build          # Compile the code
npm run start          # Start the server
npm test               # Run all tests
npm run debug          # Debug with MCP inspector
```

### Project Structure

- `src/dice/` - Core dice rolling logic
- `src/transports/` - Communication methods (stdio, HTTP)
- `src/server.ts` - Main MCP server
- `tests/` - Unit and integration tests

### Testing

The server includes comprehensive tests covering:

- All dice mechanics and edge cases
- Integration with MCP protocol
- Both stdio and HTTP transports

## Technical Details

### Tools Provided

#### `roll_dice`

Rolls dice with optional modifiers.

**Parameters:**

- `dice_count` (1-1000): How many dice to roll
- `dice_sides` (1-100): Sides per die
- `modifier`: Number to add/subtract
- `keep_highest`/`keep_lowest`: Keep only N best/worst dice
- `drop_highest`/`drop_lowest`: Remove N best/worst dice
- `reroll`: Array of values to reroll (e.g., [1, 2])
- `exploding`: Reroll max values and add to total
- `target_number`: Count successes ≥ this number
- `min_value`: Minimum value per die
- `label`: Text description

#### `roll_multiple`

Performs several dice rolls in one operation.

**Parameters:**

- `rolls`: Array of roll configurations
- `count`: Repeat the entire set N times

### Communication Methods

- **Stdio**: Direct process communication (recommended for most AI assistants)
- **HTTP**: Web-based API with rate limiting (for web integrations)

### Security

- All inputs validated to prevent malicious use
- No file system or network access
- Rate limiting on HTTP endpoints
- Runs in isolated environment

## Troubleshooting

**"Command not found"**: Make sure you installed the package and restarted your AI assistant.

**"Permission denied"**: Try installing with `sudo npm install -g dice-roller-mcp` on macOS/Linux.

**Still not working?**: Check that your config file syntax is correct (use a JSON validator).

## Contributing

We welcome contributions! Feel free to:

- Report bugs or request features
- Submit code improvements
- Add support for new dice mechanics
- Improve documentation

## License

MIT - see LICENSE file for details.
