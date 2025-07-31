/**
 * HTTP/SSE transport implementation for the dice rolling MCP server.
 * This transport allows the server to communicate via HTTP with Server-Sent Events (SSE)
 * for real-time communication with multiple clients.
 */
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createDiceRollingServer } from '../server.js';
import { logger } from '../utils/logging.js';

// Rate limiting configuration
const RATE_LIMIT_MS = 200; // 200ms between requests from the same client
const MAX_CLIENTS = 100; // Maximum number of concurrent clients

interface ClientInfo {
  id: string;
  lastRequestTime: number;
  ip: string;
}

interface RateLimitStore {
  [clientId: string]: ClientInfo;
}

// Track active client connections
interface ActiveClient {
  id: string;
  ip: string;
  connectedAt: number;
  endpoint: string; // 'sse' or 'rpc'
}

interface ActiveClientsStore {
  [clientId: string]: ActiveClient;
}

/**
 * Creates and configures an HTTP transport for the dice rolling server.
 * @param port The port to listen on (default: 3000)
 * @returns A configured Fastify instance
 */
export async function createHttpTransport(port: number = 3000): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // We'll handle logging ourselves
    trustProxy: true, // Trust proxy headers for proper client IP detection
    connectionTimeout: 10000, // 10 seconds connection timeout
    keepAliveTimeout: 60000, // 60 seconds keep-alive timeout
  });

  // Store for rate limiting
  const rateLimitStore: RateLimitStore = {};
  
  // Store for active client connections
  const activeClientsStore: ActiveClientsStore = {};

  // Helper function to get client identifier
  function getClientId(request: FastifyRequest): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return request.ip || ip || 'unknown';
  }

  // Helper function to check rate limiting
  function checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const clientInfo = rateLimitStore[clientId];
    
    if (!clientInfo) {
      rateLimitStore[clientId] = {
        id: clientId,
        lastRequestTime: now,
        ip: clientId
      };
      return true;
    }

    if (now - clientInfo.lastRequestTime < RATE_LIMIT_MS) {
      return false;
    }

    clientInfo.lastRequestTime = now;
    return true;
  }

  // Helper function to check if client can connect
  function canClientConnect(clientId: string, ip: string): boolean {
    const activeCount = Object.keys(activeClientsStore).length;
    if (activeCount >= MAX_CLIENTS) {
      logger.warn(`Client ${clientId} rejected: maximum clients (${MAX_CLIENTS}) reached`);
      return false;
    }
    return true;
  }

  // Helper function to add client to active connections
  function addActiveClient(clientId: string, ip: string, endpoint: string): void {
    activeClientsStore[clientId] = {
      id: clientId,
      ip,
      connectedAt: Date.now(),
      endpoint
    };
  }

  // Helper function to remove client from active connections
  function removeActiveClient(clientId: string): void {
    if (activeClientsStore[clientId]) {
      delete activeClientsStore[clientId];
    }
  }

  // Clean up old rate limit entries periodically
  setInterval(() => {
    const now = Date.now();
    Object.keys(rateLimitStore).forEach(clientId => {
      if (now - rateLimitStore[clientId].lastRequestTime > 60000) { // 1 minute
        delete rateLimitStore[clientId];
      }
    });
  }, 30000); // Clean up every 30 seconds

  // Clean up stale active client entries periodically
  setInterval(() => {
    const now = Date.now();
    Object.keys(activeClientsStore).forEach(clientId => {
      // Remove clients that haven't been active for 5 minutes
      if (now - activeClientsStore[clientId].connectedAt > 300000) {
        delete activeClientsStore[clientId];
      }
    });
  }, 60000); // Clean up every minute

  // Create the MCP server
  const server = createDiceRollingServer();

  // Health check endpoint
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // SSE endpoint for real-time communication
  fastify.get('/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = getClientId(request);
    const ip = request.ip || 'unknown';
    
    // Check client limit
    if (!canClientConnect(clientId, ip)) {
      reply.code(503).send({
        error: 'Service unavailable',
        message: `Maximum number of clients (${MAX_CLIENTS}) reached. Please try again later.`
      });
      return;
    }
    
    // Check rate limiting
    if (!checkRateLimit(clientId)) {
      reply.code(429).send({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please wait ${RATE_LIMIT_MS}ms between requests.`
      });
      return;
    }

    // Add client to active connections
    addActiveClient(clientId, ip, 'sse');

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
    }, 30000); // Send ping every 30 seconds

    // Handle client disconnect
    request.raw.on('close', () => {
      clearInterval(keepAlive);
      removeActiveClient(clientId);
    });
  });

    // JSON-RPC endpoint for tool calls (maintained for compatibility)
  fastify.post('/rpc', async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = getClientId(request);
    const ip = request.ip || 'unknown';
    
    // Check client limit
    if (!canClientConnect(clientId, ip)) {
      reply.code(503).send({
        error: 'Service unavailable',
        message: `Maximum number of clients (${MAX_CLIENTS}) reached. Please try again later.`
      });
      return;
    }
    
    // Check rate limiting
    if (!checkRateLimit(clientId)) {
      reply.code(429).send({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please wait ${RATE_LIMIT_MS}ms between requests.`
      });
      return;
    }

    // Add client to active connections
    addActiveClient(clientId, ip, 'rpc');

    try {
      const body = request.body as any;
      
      // Validate JSON-RPC format
      if (!body || typeof body !== 'object') {
        reply.code(400).send({
          error: 'Invalid JSON-RPC request',
          message: 'Request body must be a valid JSON object'
        });
        removeActiveClient(clientId);
        return;
      }

      if (!body.method || typeof body.method !== 'string') {
        reply.code(400).send({
          error: 'Invalid JSON-RPC request',
          message: 'Request must include a "method" field'
        });
        removeActiveClient(clientId);
        return;
      }

      // Handle MCP tool calls
      if (body.method === 'tools/call') {
        const params = body.params || {};
        const toolName = params.name;
        const toolArgs = params.arguments || {};

        if (!toolName) {
          reply.code(400).send({
            error: 'Invalid tool call',
            message: 'Tool name is required'
          });
          removeActiveClient(clientId);
          return;
        }

        // Call the appropriate tool on the MCP server
        let result;
        try {
          if (toolName === 'roll_dice') {
            // Import and call the roll_dice function directly
            const { rollDice } = await import('../dice/roll.js');
            const { validateRollDiceParams } = await import('../dice/validation.js');
            
            // Validate parameters
            const validationResult = validateRollDiceParams(toolArgs);
            if (!validationResult.success) {
              reply.code(400).send({
                jsonrpc: '2.0',
                id: body.id || null,
                error: {
                  code: -32602,
                  message: 'Invalid parameters',
                  data: validationResult.errors
                }
              });
              return;
            }

            // Perform the dice roll
            const rollResult = rollDice(validationResult.data);
            const timestamp = new Date().toISOString();

            result = {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  result: rollResult,
                  metadata: {
                    parameters: toolArgs,
                    timestamp
                  }
                }, null, 2)
              }]
            };
          } else if (toolName === 'roll_multiple') {
            // Import and call the roll_multiple function directly
            const { rollDice } = await import('../dice/roll.js');
            const { validateRollMultipleParams } = await import('../dice/validation.js');
            
            // Validate parameters
            const validationResult = validateRollMultipleParams(toolArgs);
            if (!validationResult.success) {
              reply.code(400).send({
                jsonrpc: '2.0',
                id: body.id || null,
                error: {
                  code: -32602,
                  message: 'Invalid parameters',
                  data: validationResult.errors
                }
              });
              return;
            }

            const validatedParams = validationResult.data;
            const count = validatedParams.count || 1;
            const results = [];

            // Perform all the dice rolls
            for (let i = 0; i < count; i++) {
              for (const rollParams of validatedParams.rolls) {
                results.push(rollDice(rollParams));
              }
            }

            const timestamp = new Date().toISOString();

            result = {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  results,
                  metadata: {
                    parameters: toolArgs,
                    timestamp
                  }
                }, null, 2)
              }]
            };
          } else {
            reply.code(400).send({
              error: 'Unknown tool',
              message: `Tool "${toolName}" is not supported`
            });
            removeActiveClient(clientId);
            return;
          }

          // Return JSON-RPC response
          reply.send({
            jsonrpc: '2.0',
            id: body.id || null,
            result: result
          });

          // Remove RPC client from active connections after response
          removeActiveClient(clientId);

        } catch (error) {
          logger.error(`Error calling tool ${toolName}:`, error);
          reply.code(500).send({
            jsonrpc: '2.0',
            id: body.id || null,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          });
          
          // Remove RPC client from active connections on error
          removeActiveClient(clientId);
        }
      } else {
        reply.code(400).send({
          error: 'Unsupported method',
          message: `Method "${body.method}" is not supported`
        });
        removeActiveClient(clientId);
      }

    } catch (error) {
      logger.error('Error processing JSON-RPC request:', error);
      reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to process request'
      });
      removeActiveClient(clientId);
    }
  });

  // CORS configuration
  await fastify.register(import('@fastify/cors'), {
    origin: true,
    credentials: true
  });

  return fastify;
}

/**
 * Starts the dice rolling server with HTTP transport.
 * @param port The port to listen on (default: 3000)
 */
export async function startHttpServer(port: number = 3000): Promise<void> {
  try {
    const fastify = await createHttpTransport(port);

    // Start the server
    await fastify.listen({ port, host: '0.0.0.0' });

    logger.info(`HTTP server started on port ${port}`);

    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      await fastify.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await fastify.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start HTTP server:', error);
    process.exit(1);
  }
} 