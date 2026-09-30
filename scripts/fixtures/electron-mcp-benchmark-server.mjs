import automationModule from '../../src/adapters/electron/electron-automation.ts';
import projectRegistryModule from '../../src/application/project-registry.ts';
import mcpServerModule from '../../src/transport/mcp-server.ts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { serveStdio } = require('@modelcontextprotocol/server/stdio');

const { createElectronAutomation } = automationModule;
const { ProjectRegistry } = projectRegistryModule;
const { createMcpServer } = mcpServerModule;

const discoveryPort = Number(process.env.ELECTRON_MCP_BENCHMARK_DISCOVERY_PORT);
if (!Number.isInteger(discoveryPort) || discoveryPort < 1 || discoveryPort > 65_535) {
  throw new Error('ELECTRON_MCP_BENCHMARK_DISCOVERY_PORT must be a valid TCP port.');
}

const config = {
  portRange: [discoveryPort, discoveryPort],
  projects: { benchmark: { port: discoveryPort } },
};
const projects = new ProjectRegistry({
  load: () => config,
  save: () => undefined,
});
const automation = createElectronAutomation();
const createServer = () => createMcpServer({ automation, projects });
const stdio = serveStdio(createServer, {
  legacy: 'reject',
  onerror: (error) => process.stderr.write(`${error.stack ?? error.message}\n`),
});

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await Promise.allSettled([stdio.close(), automation.close()]);
};

process.once('SIGINT', () => void close().finally(() => process.exit()));
process.once('SIGTERM', () => void close().finally(() => process.exit()));
