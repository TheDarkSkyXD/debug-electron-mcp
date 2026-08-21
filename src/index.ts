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

function registerShutdown(close: () => Promise<void>): void {
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void close()
      .catch((error: unknown) => {
        logger.error('Shutdown error:', error);
        process.exitCode = 1;
      })
      .finally(() => process.exit());
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

async function closeAll(resources: readonly (() => Promise<void>)[]): Promise<void> {
  const results = await Promise.allSettled(resources.map((close) => close()));
  const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length > 0) throw new AggregateError(errors, 'One or more resources failed to close.');
}

async function main(): Promise<void> {
  const automation = createElectronAutomation();
  const dependencies = {
    automation,
    projects: new ProjectRegistry(new JsonProjectRegistryStore()),
  };
  const createServer = () => createMcpServer(dependencies);

  if (process.argv.includes('serve')) {
    const http = await startHttpServer(createServer, parsePort(process.argv));
    registerShutdown(() => closeAll([() => http.close(), () => automation.close()]));
    return;
  }
  const stdio = serveStdio(createServer, {
    legacy: 'reject',
    onerror: (error) => logger.error('MCP stdio error:', error),
  });
  registerShutdown(() => closeAll([() => stdio.close(), () => automation.close()]));
}

void main().catch((error: unknown) => {
  logger.error('Server error:', error);
  process.exitCode = 1;
});
