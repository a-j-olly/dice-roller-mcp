/**
 * MCP server implementation for the dice rolling service.
 * This file sets up the MCP server with the roll_dice and roll_multiple tools.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { rollDice } from './dice/roll.js';
import { validateRollDiceParams, validateRollMultipleParams } from './dice/validation.js';
import { ErrorResponse } from './dice/types.js';
import { logger } from './utils/logging.js';

/**
 * Creates an MCP server for the dice rolling service.
 * @returns A configured MCP server instance
 */
export function createDiceRollingServer(): McpServer {
  const server = new McpServer({
    name: 'Dice Rolling Server',
    version: '1.0.0'
  });

  server.tool(
    'roll_dice',
    {
      dice_count: z.number().int().min(1).max(1000),
      dice_sides: z.number().int().min(1).max(100),
      modifier: z.number().optional(),
      keep_highest: z.number().int().positive().optional(),
      keep_lowest: z.number().int().positive().optional(),
      drop_highest: z.number().int().positive().optional(),
      drop_lowest: z.number().int().positive().optional(),
      reroll: z.array(z.number().int()).optional(),
      exploding: z.boolean().optional(),
      target_number: z.number().int().positive().optional(),
      min_value: z.number().int().positive().optional(),
      label: z.string().optional()
    },
    async (args, extra) => {
      try {
        const validationResult = validateRollDiceParams(args);
        if (!validationResult.success) {
          logger.error('Invalid parameters for roll_dice', validationResult.errors);
          return handleError('Invalid parameters provided', validationResult.errors);
        }

        const result = rollDice(validationResult.data);
        const timestamp = new Date().toISOString();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              result,
              metadata: {
                parameters: args,
                timestamp
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Error in roll_dice tool', error);
        return handleError('Internal server error', [{
          parameter: 'unknown',
          issue: error instanceof Error ? error.message : 'An unexpected error occurred'
        }]);
      }
    }
  );

  server.tool(
    'roll_multiple',
    {
      rolls: z.array(z.object({
        dice_count: z.number().int().min(1).max(1000),
        dice_sides: z.number().int().min(1).max(100),
        modifier: z.number().optional(),
        keep_highest: z.number().int().positive().optional(),
        keep_lowest: z.number().int().positive().optional(),
        drop_highest: z.number().int().positive().optional(),
        drop_lowest: z.number().int().positive().optional(),
        reroll: z.array(z.number().int()).optional(),
        exploding: z.boolean().optional(),
        target_number: z.number().int().positive().optional(),
        min_value: z.number().int().positive().optional(),
        label: z.string().optional()
      })).min(1, { message: 'Must include at least one roll configuration' }),
      count: z.number().int().positive().optional()
    },
    async (args, extra) => {
      try {
        const validationResult = validateRollMultipleParams(args);
        if (!validationResult.success) {
          logger.error('Invalid parameters for roll_multiple', validationResult.errors);
          return handleError('Invalid parameters provided', validationResult.errors);
        }

        const validatedParams = validationResult.data;
        const count = validatedParams.count || 1;
        const results = [];

        for (let i = 0; i < count; i++) {
          for (const rollParams of validatedParams.rolls) {
            results.push(rollDice(rollParams));
          }
        }

        const timestamp = new Date().toISOString();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              results,
              metadata: {
                parameters: args,
                timestamp
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Error in roll_multiple tool', error);
        return handleError('Internal server error', [{
          parameter: 'unknown',
          issue: error instanceof Error ? error.message : 'An unexpected error occurred'
        }]);
      }
    }
  );

  return server;
}

/**
 * Helper function to handle errors in a consistent format.
 * @param message Error message
 * @param details Array of error details
 * @returns Tool response with error information
 */
export function handleError(message: string, details: ErrorResponse['error']['details']) {
  const errorResponse: ErrorResponse = {
    error: {
      message,
      details
    }
  };

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(errorResponse, null, 2)
    }],
    isError: true
  };
}