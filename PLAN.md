# Dice Rolling MCP Server Implementation Blueprint

## Project Overview

This project will create an MCP (Model Context Protocol) server that provides dice rolling functionality to support LLM agents assisting with tabletop RPG sessions. The server will implement various dice rolling operations (keep highest/lowest, rerolls, exploding dice, etc.) and expose them through a standardized MCP interface via both stdio and HTTP/SSE transports.

## Implementation Plan

### Phase 1: Foundation Setup

#### Step 1: Project Structure & Configuration
1. Create the project directory structure as specified in the SPEC
2. Initialize package.json with required dependencies:
   - `@modelcontextprotocol/sdk` for MCP implementation
   - `zod` for parameter validation
   - `fastify` for HTTP server
3. Configure TypeScript (tsconfig.json) targeting ES2022 with Node.js module system
4. Set up Jest testing framework (jest.config.js)

#### Step 2: Core Types & Validation
1. Define interface types in `src/dice/types.ts`:
   - `RollDiceParams` for input parameters
   - `DieResult` for individual die results
   - `RollResult` for complete roll results
   - Error response types
2. Implement Zod validation schemas in `src/dice/validation.ts`:
   - Schema for `roll_dice` parameters with proper constraints
   - Schema for `roll_multiple` parameters
   - Validation helper functions
3. Create basic logging utility in `src/utils/logging.ts`

### Phase 2: Core Functionality

#### Step 3: Dice Rolling Logic
1. Implement core dice rolling functions in `src/dice/roll.ts`:
   - Main `rollDice` function
   - Helper for rolling a single die
   - Functions for each dice operation:
     - keepHighestDice/keepLowestDice
     - rerollDice
     - explodeDice
     - applyMinValue
     - countSuccesses
2. Implement operation notation and description generators
3. Write unit tests for dice rolling functions

#### Step 4: MCP Server Implementation
1. Create the base server in `src/server.ts`:
   - Initialize MCP server with proper capabilities
   - Implement the `roll_dice` tool with parameter validation
   - Implement the `roll_multiple` tool
2. Handle error responses in a consistent, LLM-readable format
3. Write tests for server functionality

### Phase 3: Transport Layers

#### Step 5: Stdio Transport
1. Implement stdio transport in `src/transports/stdio.ts`:
   - Configure StdioServerTransport from MCP SDK
   - Connect the server to the transport
2. Create the entry point `src/index.ts` with stdio support

#### Step 6: HTTP/SSE Transport
1. Implement HTTP/SSE transport in `src/transports/http.ts`:
   - Set up Fastify server
   - Configure SSE endpoints
   - Implement JSON-RPC handling
   - Add 200ms rate limiting
   - Support multiple client connections
2. Extend the entry point to support HTTP transport based on command-line arguments

### Phase 4: Finalization

#### Step 7: Testing & Refinement
1. Complete test suite:
   - Unit tests for all components
   - Integration tests for the server
   - Edge case handling tests
2. Refine error handling and logging

#### Step 8: Deployment & Documentation
1. Create Dockerfile for containerization
2. Add Docker-related scripts to package.json
3. Complete README.md with usage instructions
4. Add JSDoc comments to all public functions

## Step-by-Step Implementation

### Iteration 1: Project Setup
```bash
mkdir -p dice-rolling-server-mcp/src/{dice,transports,utils} dice-rolling-server-mcp/tests/dice
cd dice-rolling-server-mcp
npm init -y
npm install @modelcontextprotocol/sdk fastify zod
npm install --save-dev typescript @types/node jest ts-jest @types/jest
```

Create the following configuration files:
- package.json (with scripts)
- tsconfig.json
- jest.config.js
- .gitignore

### Iteration 2: Define Core Types and Validation
1. Create `src/dice/types.ts`:
   - Define interfaces for parameters and results
   - Define error response types

2. Create `src/dice/validation.ts`:
   - Implement Zod schemas with constraints
   - Create validation helper functions

3. Create `src/utils/logging.ts`:
   - Implement minimal error logging

### Iteration 3: Implement Core Dice Rolling
1. Create `src/dice/roll.ts`:
   - Implement main roll function
   - Implement all helper functions
   - Add operation and description generators

2. Create tests for validation and dice rolling

### Iteration 4: Build MCP Server
1. Create `src/server.ts`:
   - Set up MCP server
   - Define roll_dice tool
   - Define roll_multiple tool
   - Implement error handling

2. Create `src/transports/stdio.ts`
3. Create minimal entry point `src/index.ts`

### Iteration 5: Add HTTP Transport
1. Create `src/transports/http.ts`:
   - Implement Fastify server
   - Add SSE support
   - Implement rate limiting

2. Extend entry point to support both transports

### Iteration 6: Complete Project
1. Create Dockerfile
2. Finalize tests
3. Complete documentation
4. Test full functionality

## Key Technical Considerations

1. **Parameter Validation**: Use Zod for strict parameter validation with clear error messages for LLMs.

2. **Dice Rolling Logic**:
   - Keep highest/lowest: Sort dice and mark only the specified number as "kept"
   - Rerolls: Track multiple rolls per die and mark which ones were rerolled
   - Exploding dice: Continue rolling when maximum value is achieved, with a reasonable limit
   - Target number counting: Count successes instead of summing values
   - Minimum values: Enforce minimum values for each die

3. **Response Structure**:
   - Include detailed information about each die
   - Track all rolls for transparency
   - Include operation notation and human-readable descriptions

4. **Transport Implementation**:
   - Stdio: Use MCP SDK's StdioServerTransport
   - HTTP/SSE: Implement with Fastify and proper rate limiting

5. **Error Handling**:
   - Format errors consistently for LLM consumption
   - Log errors with appropriate context

6. **Testing Strategy**:
   - Unit tests for dice rolling and validation logic
   - Integration tests for the server
   - Mock Math.random() for deterministic dice tests
