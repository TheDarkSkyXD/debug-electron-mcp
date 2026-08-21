import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import discovery from '../src/adapters/electron/discovery.ts';
import connectionPoolModule from '../src/adapters/electron/cdp-connection-pool.ts';
import discoveryCacheModule from '../src/adapters/electron/discovery-cache.ts';

const { scanForElectronApps } = discovery;
const { CdpConnectionPool } = connectionPoolModule;
const { ElectronDiscoveryCache } = discoveryCacheModule;

const root = fileURLToPath(new URL('..', import.meta.url));
const before = { toolsListBytes: 9543, estimatedTokens: 2386 };
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string')
      return reject(new Error('Could not allocate a TCP port.'));
    server.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const processHandle = spawn(process.execPath, ['dist/index.js', 'serve', '--port', String(port)], {
  cwd: root,
  stdio: 'pipe',
});

function meta() {
  return {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientCapabilities': {},
    'io.modelcontextprotocol/clientInfo': { name: 'debug-electron-mcp-measure', version: '1.0.0' },
  };
}

async function mcpRequest(method, params, id) {
  const startedAt = performance.now();
  const requestName = typeof params.name === 'string' ? params.name : 'debug-electron-mcp-measure';
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
      'mcp-name': requestName,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: { ...params, _meta: meta() } }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${method} failed with ${response.status}.`);
  const payload = JSON.parse(body);
  if (payload.error) throw new Error(`${method} returned ${JSON.stringify(payload.error)}.`);
  return {
    body,
    elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
  };
}

async function toolsList(id = 1) {
  return (await mcpRequest('tools/list', {}, id)).body;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch {
      /* starting */
    }
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
    return new Response(JSON.stringify([{ id: `target-${portNumber}`, type: 'page' }]), {
      status: 200,
    });
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
    return {
      fixedProbeLatencyMs: latencyMs,
      warmups: 2,
      parallelSamplesMs: parallelSamples,
      serialReferenceSamplesMs: serialSamples,
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function summarizeLatency(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
  return {
    samples: sorted.length,
    minMs: sorted[0],
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted.at(-1),
  };
}

async function benchmarkSequentialWarmPath() {
  const originalFetch = globalThis.fetch;
  const ports = [9222, 9223, 9224, 9225, 9300, 9301];
  let probeRequests = 0;
  globalThis.fetch = async (url) => {
    probeRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const portNumber = new URL(String(url)).port;
    return new Response(JSON.stringify([{ id: `target-${portNumber}`, type: 'page' }]), {
      status: 200,
    });
  };

  let coldDiscoveryMs;
  const warmDiscoverySamples = [];
  try {
    const cache = new ElectronDiscoveryCache({ probe: scanForElectronApps });
    let startedAt = performance.now();
    await cache.scan(ports);
    coldDiscoveryMs = Number((performance.now() - startedAt).toFixed(2));
    for (let index = 0; index < 20; index += 1) {
      startedAt = performance.now();
      await cache.scan(ports);
      warmDiscoverySamples.push(Number((performance.now() - startedAt).toFixed(4)));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  if (probeRequests !== ports.length) {
    throw new Error(
      `Warm discovery repeated network probes: expected ${ports.length}, got ${probeRequests}.`,
    );
  }

  const cdpServer = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  let cdpConnections = 0;
  let cdpEvaluations = 0;
  cdpServer.on('connection', (socket) => {
    cdpConnections += 1;
    socket.on('message', (data) => {
      const request = JSON.parse(data.toString());
      if (typeof request.id !== 'number') return;
      if (request.method === 'Runtime.evaluate') {
        cdpEvaluations += 1;
        socket.send(
          JSON.stringify({
            id: request.id,
            result: { result: { type: 'number', value: cdpEvaluations } },
          }),
        );
        return;
      }
      socket.send(JSON.stringify({ id: request.id, result: {} }));
    });
  });
  await once(cdpServer, 'listening');
  const address = cdpServer.address();
  if (!address || typeof address === 'string') throw new Error('CDP benchmark did not bind.');
  const pool = new CdpConnectionPool();
  const cdpUrl = `ws://127.0.0.1:${address.port}`;
  let coldCdpMs;
  const warmCdpSamples = [];
  try {
    let startedAt = performance.now();
    await pool.evaluate(cdpUrl, '1 + 1');
    coldCdpMs = Number((performance.now() - startedAt).toFixed(2));
    for (let index = 0; index < 20; index += 1) {
      startedAt = performance.now();
      await pool.evaluate(cdpUrl, '1 + 1');
      warmCdpSamples.push(Number((performance.now() - startedAt).toFixed(4)));
    }
  } finally {
    await pool.close();
    for (const client of cdpServer.clients) client.terminate();
    await new Promise((resolve, reject) =>
      cdpServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
  if (cdpConnections !== 1 || cdpEvaluations !== 21) {
    throw new Error(
      `CDP reuse failed: ${cdpConnections} connection(s), ${cdpEvaluations} evaluation(s).`,
    );
  }

  return {
    discovery: {
      coldMs: coldDiscoveryMs,
      warm: summarizeLatency(warmDiscoverySamples),
      networkRequests: probeRequests,
    },
    cdp: {
      coldMs: coldCdpMs,
      warm: summarizeLatency(warmCdpSamples),
      connections: cdpConnections,
      evaluations: cdpEvaluations,
    },
  };
}

async function benchmarkHttpOperations() {
  const operations = {
    'server/discover': () => mcpRequest('server/discover', {}, 100),
    'tools/list': () => mcpRequest('tools/list', {}, 101),
    'tools/call describe_electron_command': () =>
      mcpRequest(
        'tools/call',
        { name: 'describe_electron_command', arguments: { command: 'wait' } },
        102,
      ),
  };
  const results = {};

  for (const [name, operation] of Object.entries(operations)) {
    for (let index = 0; index < 3; index += 1) await operation();
    const samples = [];
    let responseBytes = 0;
    for (let index = 0; index < 20; index += 1) {
      const result = await operation();
      samples.push(result.elapsedMs);
      responseBytes = Buffer.byteLength(result.body);
    }
    results[name] = { ...summarizeLatency(samples), responseBytes };
  }

  return results;
}

try {
  await waitForHealth();
  const first = await toolsList();
  const second = await toolsList(1);
  if (first !== second) throw new Error('Repeated tools/list responses differ.');
  const parsed = JSON.parse(first);
  const bytes = Buffer.byteLength(first);
  const descriptions = parsed.result.tools.map((tool) => tool.description ?? '').join('');
  const toolBytes = Object.fromEntries(
    parsed.result.tools.map((tool) => [tool.name, Buffer.byteLength(JSON.stringify(tool))]),
  );
  const result = {
    before,
    after: {
      toolsListBytes: bytes,
      descriptionChars: descriptions.length,
      estimatedTokens: Math.ceil(bytes / 4),
      estimateMethod: 'ceil(JSON bytes / 4), not tokenizer-exact',
      repeatedResponseEqual: true,
      toolBytes,
    },
    httpOperations: await benchmarkHttpOperations(),
    sequentialWarmPath: await benchmarkSequentialWarmPath(),
    discovery: await benchmarkDiscovery(),
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await stopChild(processHandle);
}
