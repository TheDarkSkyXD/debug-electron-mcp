import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { createMcpServer } from './create-server';
import { logger } from './utils/logger';
import { tools } from './tools';

/** Read the full request body as a string */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/** Send a JSON response */
function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Start the MCP server in HTTP mode using StreamableHTTPServerTransport.
 * Uses only Node built-in http — no express or other dependencies.
 * Supports multiple concurrent AI client sessions.
 */
export async function startHttpServer(port: number = 3100): Promise<void> {
  // Map of session ID -> transport
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const path = url.pathname;

    // Health check
    if (path === '/health' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        name: '@debugelectron/debug-electron-mcp',
        mode: 'http',
        activeSessions: Object.keys(transports).length,
        tools: tools.map((t) => t.name),
      });
      return;
    }

    // Only handle /mcp
    if (path !== '/mcp') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      if (req.method === 'POST') {
        const bodyStr = await readBody(req);
        const body = bodyStr ? JSON.parse(bodyStr) : undefined;

        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(body)) {
          // New initialization request
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid: string) => {
              logger.info(`HTTP session initialized: ${sid}`);
              transports[sid] = transport;
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports[sid]) {
              logger.info(`HTTP session closed: ${sid}`);
              delete transports[sid];
            }
          };

          const mcpServer = createMcpServer();
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, body);
          return;
        } else {
          sendJson(res, 400, {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
            id: null,
          });
          return;
        }

        await transport.handleRequest(req, res, body);
      } else if (req.method === 'GET') {
        if (!sessionId || !transports[sessionId]) {
          res.writeHead(400);
          res.end('Invalid or missing session ID');
          return;
        }
        await transports[sessionId].handleRequest(req, res);
      } else if (req.method === 'DELETE') {
        if (!sessionId || !transports[sessionId]) {
          res.writeHead(400);
          res.end('Invalid or missing session ID');
          return;
        }
        await transports[sessionId].handleRequest(req, res);
      } else {
        res.writeHead(405);
        res.end('Method not allowed');
      }
    } catch (error) {
      logger.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  server.listen(port, '127.0.0.1', () => {
    logger.info(`Electron MCP HTTP Server listening on http://127.0.0.1:${port}`);
    logger.info(`MCP endpoint: http://localhost:${port}/mcp`);
    logger.info(`Health check: http://localhost:${port}/health`);
    logger.info('Available tools:', tools.map((t) => t.name).join(', '));
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down HTTP server...');
    for (const sid in transports) {
      try {
        await transports[sid].close();
        delete transports[sid];
      } catch (error) {
        logger.error(`Error closing session ${sid}:`, error);
      }
    }
    server.close();
    process.exit(0);
  });
}
