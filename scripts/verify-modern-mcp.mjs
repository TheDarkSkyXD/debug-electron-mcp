import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageMetadata = createRequire(import.meta.url)('../package.json');
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') return reject(new Error('Could not allocate a TCP port.'));
    server.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const processHandle = spawn(process.execPath, ['dist/index.js', 'serve', '--port', String(port)], { cwd: root, stdio: 'pipe' });

function requestMeta() {
  return {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientCapabilities': {},
    'io.modelcontextprotocol/clientInfo': { name: 'debug-electron-mcp-verifier', version: '1.0.0' },
  };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch { /* process is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('MCP HTTP server did not become healthy.');
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
}

async function call(method, params, id, headers = {}) {
  const mcpName = headers['mcp-name'] ?? params?.name ?? 'debug-electron-mcp-verifier';
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
      'mcp-name': mcpName,
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: { ...params, _meta: requestMeta() } }),
  });
}

try {
  await waitForHealth();
  const discover = await call('server/discover', {}, 1);
  const discoverBody = await discover.json();
  if (discover.status !== 200 || discoverBody.result?.supportedVersions?.[0] !== '2026-07-28') throw new Error('server/discover did not negotiate MCP 2026.');
  const advertisedVersion = discoverBody.result?._meta?.['io.modelcontextprotocol/serverInfo']?.version;
  if (advertisedVersion !== packageMetadata.version) {
    throw new Error(`server/discover advertised ${advertisedVersion}; package is ${packageMetadata.version}.`);
  }

  const firstList = await call('tools/list', {}, 2, { 'mcp-session-id': 'ignored-legacy-header' });
  const firstListText = await firstList.text();
  if (firstList.status !== 200 || firstList.headers.has('mcp-session-id')) throw new Error('tools/list depended on or emitted a session header.');
  const secondList = await call('tools/list', {}, 2);
  const secondListText = await secondList.text();
  if (firstListText !== secondListText) throw new Error('Independent tools/list responses were not deterministic.');

  const projects = await call('tools/call', { name: 'list_projects', arguments: {} }, 6);
  const projectsBody = await projects.json();
  if (projects.status !== 200 || projectsBody.result?.structuredContent?.ok !== true) {
    throw new Error('list_projects did not return a successful structured result.');
  }

  const commandHelp = await call('tools/call', { name: 'describe_electron_command', arguments: { command: 'wait' } }, 7);
  const commandHelpBody = await commandHelp.json();
  const waitProperties = commandHelpBody.result?.structuredContent?.data?.inputSchema?.properties;
  if (commandHelp.status !== 200 || !waitProperties?.duration || !waitProperties?.timeout) {
    throw new Error('describe_electron_command did not expose the wait command schema.');
  }

  const missingHeaders = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: { _meta: requestMeta() } }),
  });
  if (missingHeaders.status < 400) throw new Error('Modern traffic without required MCP headers was accepted.');
  const mismatchedMethod = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28',
      'mcp-method': 'server/discover', 'mcp-name': 'debug-electron-mcp-verifier',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: { _meta: requestMeta() } }),
  });
  if (mismatchedMethod.status < 400) throw new Error('Mcp-Method header mismatch was accepted.');

  const legacy = await call(
    'initialize',
    {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'legacy-client', version: '1.0.0' },
    },
    5,
  );
  if (legacy.status < 400) throw new Error('Legacy initialize traffic was accepted.');

  const getResponse = await fetch(`http://127.0.0.1:${port}/mcp`);
  if (getResponse.status !== 405) throw new Error('GET /mcp was accepted.');

  console.log(JSON.stringify({ discover: 'ok', version: advertisedVersion, statelessCalls: 'ok', toolsCall: 'ok', structuredResults: 'ok', headers: 'validated', legacy: 'rejected', sessionHeader: 'absent', get: 'rejected' }));
} finally {
  await stopChild(processHandle);
}
