import { createServer, type Server, type ServerResponse } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { createMcpServer, toolNames } from './mcp-server';
import { logger } from './utils/logger';

export interface RunningHttpServer {
  readonly server: Server;
  readonly port: number;
  close(): Promise<void>;
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

export async function startHttpServer(port = 3100): Promise<RunningHttpServer> {
  const handler = createMcpHandler(createMcpServer, {
    legacy: 'reject',
    responseMode: 'json',
    onerror: (error) => logger.error('MCP HTTP error:', error),
  });
  const nodeHandler = toNodeHandler(handler, {
    onerror: (error) => logger.error('MCP Node adapter error:', error),
  });
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname === '/health' && request.method === 'GET') {
      sendJson(response, 200, {
        status: 'ok',
        name: '@debugelectron/debug-electron-mcp',
        protocol: '2026-07-28',
        tools: toolNames,
      });
      return;
    }
    if (url.pathname !== '/mcp') {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Only POST /mcp is supported' });
      return;
    }
    if (!validateHost(request, response) || !validateOrigin(request, response)) return;
    await nodeHandler(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  logger.info(`Electron MCP HTTP server listening at http://127.0.0.1:${boundPort}/mcp`);

  return {
    server,
    port: boundPort,
    close: async () => {
      await handler.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
