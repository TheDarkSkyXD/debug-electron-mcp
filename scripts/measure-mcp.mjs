import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import discovery from '../src/utils/electron-discovery.ts';

const { scanForElectronApps } = discovery;

const root = fileURLToPath(new URL('..', import.meta.url));
const before = { toolsListBytes: 9543, estimatedTokens: 2386 };
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

function meta() {
  return {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientCapabilities': {},
    'io.modelcontextprotocol/clientInfo': { name: 'debug-electron-mcp-measure', version: '1.0.0' },
  };
}

async function toolsList() {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list', 'mcp-name': 'debug-electron-mcp-measure' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: meta() } }),
  });
  if (!response.ok) throw new Error(`tools/list failed with ${response.status}.`);
  return response.text();
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch { /* starting */ }
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

async function benchmarkDiscovery() {
  const originalFetch = globalThis.fetch;
  const ports = [9222, 9223, 9224, 9225, 9300, 9301];
  const latencyMs = 20;
  globalThis.fetch = async (url) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    const portNumber = new URL(String(url)).port;
    return new Response(JSON.stringify([{ id: `target-${portNumber}`, type: 'page' }]), { status: 200 });
  };
  const measure = async (run) => {
    const start = performance.now();
    await run();
    return Number((performance.now() - start).toFixed(2));
  };
  const serial = async () => {
    for (const portNumber of ports) await globalThis.fetch(`http://localhost:${portNumber}/json`);
  };
  try {
    for (let index = 0; index < 2; index += 1) await scanForElectronApps(ports);
    const parallelSamples = [];
    const serialSamples = [];
    for (let index = 0; index < 8; index += 1) {
      parallelSamples.push(await measure(() => scanForElectronApps(ports)));
      serialSamples.push(await measure(serial));
    }
    return { fixedProbeLatencyMs: latencyMs, warmups: 2, parallelSamplesMs: parallelSamples, serialReferenceSamplesMs: serialSamples };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

try {
  await waitForHealth();
  const first = await toolsList();
  const second = await toolsList();
  if (first !== second) throw new Error('Repeated tools/list responses differ.');
  const parsed = JSON.parse(first);
  const bytes = Buffer.byteLength(first);
  const descriptions = parsed.result.tools.map((tool) => tool.description ?? '').join('');
  const result = {
    before,
    after: {
      toolsListBytes: bytes,
      descriptionChars: descriptions.length,
      estimatedTokens: Math.ceil(bytes / 4),
      estimateMethod: 'ceil(JSON bytes / 4), not tokenizer-exact',
      repeatedResponseEqual: true,
    },
    discovery: await benchmarkDiscovery(),
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await stopChild(processHandle);
}
