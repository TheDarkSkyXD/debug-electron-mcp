#!/usr/bin/env node

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createElectronAutomation } from './adapters/electron/electron-automation';
import { JsonProjectRegistryStore } from './adapters/persistence/json-project-registry-store';
import { ProjectRegistry } from './application/project-registry';
import { logger } from './shared/logger';
import { startHttpServer } from './transport/http-server';
import { createMcpServer } from './transport/mcp-server';

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
  const dependencies = {
    automation: createElectronAutomation(),
    projects: new ProjectRegistry(new JsonProjectRegistryStore()),
  };
  const createServer = () => createMcpServer(dependencies);

  if (process.argv.includes('serve')) {
    await startHttpServer(createServer, parsePort(process.argv));
    return;
  }
  serveStdio(createServer, {
    legacy: 'reject',
    onerror: (error) => logger.error('MCP stdio error:', error),
  });
}

void main().catch((error: unknown) => {
  logger.error('Server error:', error);
  process.exitCode = 1;
});
