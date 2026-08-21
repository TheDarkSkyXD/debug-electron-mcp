#!/usr/bin/env node

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './mcp-server';
import { startHttpServer } from './serve';
import { logger } from './utils/logger';

function parsePort(argv: readonly string[]): number {
  const portIndex = argv.indexOf('--port');
  if (portIndex === -1) return 3100;
  const value = Number(argv[portIndex + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error('--port must be an integer from 1 through 65535.');
  }
  return value;
}

async function main(): Promise<void> {
  if (process.argv.includes('serve')) {
    await startHttpServer(parsePort(process.argv));
    return;
  }
  serveStdio(createMcpServer, {
    legacy: 'reject',
    onerror: (error) => logger.error('MCP stdio error:', error),
  });
}

void main().catch((error: unknown) => {
  logger.error('Server error:', error);
  process.exitCode = 1;
});
