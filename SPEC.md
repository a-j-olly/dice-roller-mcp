# Dice Rolling MCP Server Specification

## Project Overview

**Project Name:** dice-rolling-server-mcp  
**Description:** An MCP server that provides dice rolling functionality to support an LLM Agent assisting a Games Master running virtual tabletop RPG sessions.  
**Primary Use Case:** Supporting LLM Agents for tabletop RPG assistance (D&D, Pathfinder, Call of Cthulhu, etc.)

## Core Requirements

### General Requirements

- Implementation in TypeScript using Node.js v22 LTS
- No state tracking between requests
- No authentication required
- Both stdio and HTTP/SSE transport support using Fastify for HTTP server
- Rate limiting of 200ms between requests from the same client
- Support for multiple asynchronous client connections
- Deployable locally and via Docker containerization
- Minimal logging (errors only)

### Dice Rolling Functionality

Support for the following core dice operations:

1. **Keep Highest/Lowest**
   - Example: "4d6 keep highest 3" for D&D ability scores
2. **Drop Highest/Lowest**
   - Example: "5d10 drop lowest 2"
3. **Reroll**
   - Example: "3d6 reroll 1s" - any die showing 1 is rerolled once
4. **Exploding Dice**
   - Example: "2d6 exploding" - reroll any die showing maximum value and add
5. **Target Number Counting**
   - Example: "5d10 count 8+" - count dice showing 8 or higher instead of summing
6. **Minimum Die Value**
   - Example: "4d6 minimum 2" - treat any 1s as 2s

### Parameter Constraints

- Number of dice: 1-1000
- Number of sides per die: 1-100
- Requests outside these ranges should fail immediately with appropriate error messages

### Random Number Generation

- Use Node.js Math.random() for dice rolling
- No seeding mechanism required

## Tools Specification

The server will expose two main tools through the MCP protocol:

### 1. roll_dice

**Description:** Rolls dice according to specified parameters and returns detailed results.

**Parameters:**
```typescript
{
  dice_count: number;        // Required: Number of dice to roll (1-1000)
  dice_sides: number;        // Required: Number of sides on each die (1-100)
  modifier?: number;         // Optional: Number to add/subtract from final sum
  keep_highest?: number;     // Optional: Number of highest dice to keep
  keep_lowest?: number;      // Optional: Number of lowest dice to keep
  reroll?: number[];         // Optional: Array of values that trigger a single reroll
  exploding?: boolean;       // Optional: Whether dice explode on maximum value
  target_number?: number;    // Optional: If set, count successes >= this number instead of sum
  min_value?: number;        // Optional: Minimum value for any individual die
}
```

**Return Format:**
```typescript
{
  "result": {
    "total": number,          // The final calculated total (for summed dice)
    "successes"?: number,     // Number of successful dice (only for target number rolls)
    "total_dice"?: number,    // Total dice rolled (only for target number rolls)
    "dice": [                 // Details of individual dice
      {
        "die": number,        // Die number in sequence
        "sides": number,      // Number of sides on this die
        "rolls": number[],    // All rolls of this die (including rerolls)
        "value": number,      // Final value used in calculation
        "kept": boolean,      // Whether this die was kept in final calculation
        "special": string | null // Any special flags (exploded, rerolled, etc.)
      },
      // ...more dice
    ],
    "operation": string,      // The operation performed in standard notation
    "description": string     // Human-readable description of the roll
  },
  "metadata": {
    "parameters": {           // Echo back the parameters used
      // Original parameters
    },
    "timestamp": string       // ISO timestamp of when the roll was performed
  }
}
```

### 2. roll_multiple

**Description:** Performs multiple dice rolls in a single batch operation.

**Parameters:**
```typescript
{
  rolls: Array<{            // Required: Array of dice roll configurations
    // Each object follows the roll_dice parameter format
    dice_count: number;
    dice_sides: number;
    // ...other optional parameters as in roll_dice
  }>;
  count?: number;           // Optional: Number of times to repeat the entire set
}
```

**Return Format:**
```typescript
{
  "results": [
    // Each element follows the roll_dice return format
  ],
  "metadata": {
    "parameters": {
      // Original parameters
    },
    "timestamp": string
  }
}
```

## Error Handling

- Invalid parameters should return clear error messages containing:
  - Name of the invalid parameter(s)
  - Reason the parameter is invalid
  - Format should be LLM-readable
- Example error format:
```typescript
{
  "error": {
    "message": "Invalid parameters provided",
    "details": [
      {
        "parameter": "dice_count",
        "issue": "Value 1500 exceeds maximum allowed (1000)",
        "valid_range": "1-1000"
      }
    ]
  }
}
```

## Technical Implementation

### Project Structure

```
dice-rolling-server-mcp/
├── src/
│   ├── index.ts                  # Main entry point
│   ├── server.ts                 # MCP server setup
│   ├── dice/
│   │   ├── roll.ts               # Core dice rolling functions
│   │   └── validation.ts         # Parameter validation with Zod
│   ├── transports/
│   │   ├── stdio.ts              # stdio transport implementation
│   │   └── http.ts               # HTTP/SSE with Fastify implementation
│   └── utils/
│       └── logging.ts            # Minimal logging utilities
├── tests/
│   ├── dice/
│   │   ├── roll.test.ts          # Tests for dice rolling functions
│   │   └── validation.test.ts    # Tests for validation functions
│   └── server.test.ts            # Server integration tests
├── Dockerfile                    # Docker configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Project dependencies
└── README.md                     # Project documentation
```

### Dependencies

- **Required:**
  - `@modelcontextprotocol/sdk`: MCP TypeScript SDK
  - `zod`: Parameter validation
  - `fastify`: HTTP server for SSE transport

- **No additional libraries** beyond these unless absolutely necessary

### Validation Rules with Zod

```typescript
// Example of validation schema
const rollDiceSchema = z.object({
  dice_count: z.number().int().min(1).max(1000),
  dice_sides: z.number().int().min(1).max(100),
  modifier: z.number().optional(),
  keep_highest: z.number().int().positive().optional(),
  keep_lowest: z.number().int().positive().optional(),
  reroll: z.array(z.number().int()).optional(),
  exploding: z.boolean().optional(),
  target_number: z.number().int().positive().optional(),
  min_value: z.number().int().positive().optional(),
}).refine(data => {
  // Cannot specify both keep_highest and keep_lowest
  return !(data.keep_highest && data.keep_lowest);
}, {
  message: "Cannot specify both keep_highest and keep_lowest"
});
```

### Logging Guidelines

- Log only errors and critical issues
- Include timestamp, error type, and detailed message
- Do not log successful operations or standard requests

## Testing Requirements

- **Tests should live in a `tests` folder** mirroring the main src structure
- Include at least:
  - 1 test for expected use
  - 1 edge case
  - 1 failure case
- Write unit tests for all public methods
- Mock external dependencies in tests
- Structure tests with Arrange-Act-Assert pattern
- Maintain high test coverage for critical code paths

## Coding Standards

- **Naming Conventions:**
  - PascalCase for classes/types
  - camelCase for functions/variables
  - Lowercase with hyphens for filenames
  - Test files with `.test.ts` suffix
- **Documentation:**
  - TSDoc-style comments for all public functions
  - Inline comments for complex logic
- **Code Style:**
  - Strict TypeScript typing
  - Consistent error handling patterns
  - Asynchronous programming with async/await

## LLM Integration Guide

The following information should be provided to LLMs that will be using the dice rolling server:

```markdown
# Dice Rolling MCP Server - LLM Integration Guide

## Available Tools

### 1. roll_dice
Roll dice with various modifiers and return detailed results.

**Parameters:**
- `dice_count` (number, required): Number of dice to roll (1-1000)
- `dice_sides` (number, required): Number of sides on each die (1-100)
- `modifier` (number, optional): Value to add/subtract from final sum
- `keep_highest` (number, optional): Number of highest dice to keep
- `keep_lowest` (number, optional): Number of lowest dice to keep
- `reroll` (array of numbers, optional): Values that trigger a single reroll
- `exploding` (boolean, optional): Whether dice explode on maximum value
- `target_number` (number, optional): If set, count successes >= this number instead of sum
- `min_value` (number, optional): Minimum value for any individual die

**Example Request:**
```json
{
  "dice_count": 4,
  "dice_sides": 6,
  "keep_highest": 3
}
```

**Example Response:**
```json
{
  "result": {
    "total": 14,
    "dice": [
      {
        "die": 1,
        "sides": 6,
        "rolls": [5],
        "value": 5,
        "kept": true,
        "special": null
      },
      {
        "die": 2,
        "sides": 6,
        "rolls": [3],
        "value": 3,
        "kept": true,
        "special": null
      },
      {
        "die": 3,
        "sides": 6,
        "rolls": [6],
        "value": 6,
        "kept": true,
        "special": null
      },
      {
        "die": 4,
        "sides": 6,
        "rolls": [2],
        "value": 2,
        "kept": false,
        "special": null
      }
    ],
    "operation": "4d6kh3",
    "description": "Rolled 4d6, keeping highest 3"
  },
  "metadata": {
    "parameters": {
      "dice_count": 4,
      "dice_sides": 6,
      "keep_highest": 3
    },
    "timestamp": "2025-04-17T14:32:49Z"
  }
}
```

### 2. roll_multiple
Perform multiple dice rolls in a batch operation.

**Parameters:**
- `rolls` (array, required): Array of dice roll configurations, each following the format accepted by roll_dice
- `count` (number, optional): Number of times to repeat the entire set of rolls

**Example Request:**
```json
{
  "rolls": [
    { "dice_count": 2, "dice_sides": 20, "keep_highest": 1 },
    { "dice_count": 1, "dice_sides": 8, "modifier": 2 }
  ]
}
```

## Usage Guidance for LLM

When a user asks for a dice roll:

1. Interpret the type of roll needed based on the RPG system and context
2. Construct the appropriate parameters for either `roll_dice` or `roll_multiple`
3. Call the appropriate MCP tool
4. Interpret the results based on the game context
5. Explain the results to the user in natural language

### Common Roll Translations

- "Roll for initiative" (D&D) → `roll_dice({ dice_count: 1, dice_sides: 20, modifier: <dexMod> })`
- "Make an attack with advantage" (D&D) → `roll_dice({ dice_count: 2, dice_sides: 20, keep_highest: 1 })`
- "Roll ability scores" (D&D) → `roll_multiple({ rolls: [{ dice_count: 4, dice_sides: 6, keep_highest: 3 }], count: 6 })`
- "Roll a skill check" (Call of Cthulhu) → `roll_dice({ dice_count: 1, dice_sides: 100 })` (then compare to skill value)

### Result Interpretation

The LLM should:
- Extract the `total` value for summed rolls or `successes` for counted rolls
- Use the `operation` and `description` fields to explain what happened
- Reference individual dice details for transparency when relevant
- Apply game-specific interpretations (critical hits, etc.) based on the values rolled
```

## Implementation Notes

1. **Security Considerations:**
   - No authentication required
   - Parameter validation is critical to prevent abuse
   - Rate limiting to prevent request flooding

2. **Performance Optimization:**
   - Minimize computational overhead
   - Efficient dice algorithms for large numbers of dice
   - Properly handle concurrent connections

3. **Error Handling Strategy:**
   - Validate all input parameters before processing
   - Return descriptive, LLM-readable error messages
   - Log errors with appropriate context for debugging
