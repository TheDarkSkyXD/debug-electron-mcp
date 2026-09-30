import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { WebSocketServer } from 'ws';

const MOBILE_MCP_REPOSITORY = 'https://github.com/mobile-next/mobile-mcp.git';
const MOBILE_MCP_COMMIT = '86687b17e843cf21bf98d5c7d4c07f416c7d5247';
const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = path.join(root, 'scripts', 'fixtures');

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function parseArgs(argv) {
  const options = {
    samples: 30,
    warmups: 5,
    adapterDelays: [0, 1],
    mobileRepo: undefined,
    output: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--samples') {
      options.samples = parsePositiveInteger(value, flag);
      index += 1;
    } else if (flag === '--warmups') {
      options.warmups = parsePositiveInteger(value, flag);
      index += 1;
    } else if (flag === '--adapter-delays') {
      options.adapterDelays = value.split(',').map((entry) => {
        const delay = Number(entry);
        if (!Number.isInteger(delay) || delay < 0 || delay > 1000) {
          throw new Error('--adapter-delays accepts comma-separated integers from 0 through 1000.');
        }
        return delay;
      });
      index += 1;
    } else if (flag === '--mobile-repo') {
      options.mobileRepo = path.resolve(value);
      index += 1;
    } else if (flag === '--output') {
      options.output = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown benchmark argument: ${flag}`);
    }
  }
  return options;
}

function run(command, args, cwd, stdio = 'pipe') {
  const output = execFileSync(command, args, { cwd, encoding: 'utf8', stdio });
  return typeof output === 'string' ? output.trim() : '';
}

function runNpm(args, cwd, stdio = 'pipe') {
  const bundledNpm = path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
  if (process.platform === 'win32' && fs.existsSync(bundledNpm)) {
    return run(process.execPath, [bundledNpm, ...args], cwd, stdio);
  }
  return run('npm', args, cwd, stdio);
}

function ensureMobileMcp(explicitRepo) {
  const managed = explicitRepo === undefined;
  const repo =
    explicitRepo ?? path.join(os.tmpdir(), 'debug-electron-mcp-benchmarks', MOBILE_MCP_COMMIT);

  if (
    managed &&
    fs.existsSync(repo) &&
    !fs.existsSync(path.join(repo, '.git')) &&
    fs.readdirSync(repo).length === 0
  ) {
    fs.rmdirSync(repo);
  }
  if (!fs.existsSync(repo)) {
    if (!managed) throw new Error(`The mobile-mcp repository does not exist: ${repo}`);
    fs.mkdirSync(path.dirname(repo), { recursive: true });
    run('git', ['clone', '--depth', '1', MOBILE_MCP_REPOSITORY, repo], root, 'inherit');
  }
  if (!fs.existsSync(path.join(repo, '.git'))) {
    throw new Error(`The mobile-mcp benchmark path is not a Git repository: ${repo}`);
  }

  let commit = run('git', ['rev-parse', 'HEAD'], repo);
  if (managed && commit !== MOBILE_MCP_COMMIT) {
    run('git', ['fetch', '--depth', '1', 'origin', MOBILE_MCP_COMMIT], repo, 'inherit');
    run('git', ['checkout', '--detach', MOBILE_MCP_COMMIT], repo, 'inherit');
    commit = run('git', ['rev-parse', 'HEAD'], repo);
  }

  if (commit !== MOBILE_MCP_COMMIT) {
    throw new Error(`mobile-mcp must be at ${MOBILE_MCP_COMMIT}; found ${commit}.`);
  }
  const dirty = run('git', ['status', '--porcelain', '--untracked-files=no'], repo);
  if (dirty) throw new Error('The mobile-mcp reference has tracked working-tree changes.');

  if (!fs.existsSync(path.join(repo, 'node_modules'))) {
    runNpm(['ci', '--ignore-scripts'], repo, 'inherit');
  }
  run(
    process.execPath,
    [path.join(repo, 'node_modules', 'typescript', 'bin', 'tsc')],
    repo,
    'inherit',
  );
  return { repo, commit };
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
  return {
    samples: sorted.length,
    minMs: Number(sorted[0].toFixed(3)),
    medianMs: Number(percentile(0.5).toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    maxMs: Number(sorted.at(-1).toFixed(3)),
  };
}

function contentHash(paths) {
  const files = [];
  const visit = (entry) => {
    const stats = fs.statSync(entry);
    if (stats.isDirectory()) {
      for (const child of fs.readdirSync(entry).sort()) visit(path.join(entry, child));
      return;
    }
    files.push(entry);
  };
  for (const entry of paths) visit(entry);

  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(path.relative(root, file).replaceAll(path.sep, '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function timed(operation) {
  const startedAt = performance.now();
  await operation();
  return performance.now() - startedAt;
}

async function alternate(samples, electronOperation, mobileOperation) {
  const electron = [];
  const mobile = [];
  for (let index = 0; index < samples; index += 1) {
    if (index % 2 === 0) {
      electron.push(await timed(electronOperation));
      mobile.push(await timed(mobileOperation));
    } else {
      mobile.push(await timed(mobileOperation));
      electron.push(await timed(electronOperation));
    }
  }
  return {
    electron: summarize(electron),
    mobile: summarize(mobile),
    rawSamplesMs: {
      electron: electron.map((sample) => Number(sample.toFixed(4))),
      mobile: mobile.map((sample) => Number(sample.toFixed(4))),
    },
  };
}

async function repeat(count, operation) {
  for (let index = 0; index < count; index += 1) await operation();
}

function removeBenchmarkTempDirectory(directory) {
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(directory));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Refusing to remove a directory outside the system temporary directory: ${directory}`,
    );
  }
  fs.rmSync(directory, { recursive: true, force: true });
}

function assertToolResult(result, expectedActions = 1) {
  if (result.isError) throw new Error(`Benchmark tool failed: ${JSON.stringify(result.content)}`);
  if (expectedActions === 1) return;
  const rows = result.structuredContent?.data?.results;
  if (!Array.isArray(rows) || rows.length !== expectedActions || rows.some((row) => !row.ok)) {
    throw new Error(`Electron batch returned an invalid result: ${JSON.stringify(result)}`);
  }
}

async function createElectronBackend(adapterDelayMs) {
  let connections = 0;
  let requests = 0;
  const cdp = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  cdp.on('connection', (socket) => {
    connections += 1;
    socket.on('message', (data) => {
      const request = JSON.parse(data.toString());
      if (typeof request.id !== 'number') return;
      requests += 1;
      const result =
        request.method === 'Runtime.evaluate'
          ? { result: { type: 'string', value: 'Benchmark' } }
          : {};
      const reply = () => socket.send(JSON.stringify({ id: request.id, result }));
      if (adapterDelayMs === 0) reply();
      else {
        const deadline = performance.now() + adapterDelayMs;
        setImmediate(() => {
          while (performance.now() < deadline) {
            // Concurrent CDP packets share the same simulated transport wait.
          }
          reply();
        });
      }
    });
  });
  await once(cdp, 'listening');
  const cdpAddress = cdp.address();
  if (!cdpAddress || typeof cdpAddress === 'string')
    throw new Error('CDP benchmark failed to bind.');

  let discoveries = 0;
  const discovery = createHttpServer((request, response) => {
    if (request.url !== '/json') return void response.writeHead(404).end();
    discoveries += 1;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify([
        {
          id: 'benchmark-target',
          title: 'Benchmark target',
          type: 'page',
          url: 'app://benchmark',
          webSocketDebuggerUrl: `ws://127.0.0.1:${cdpAddress.port}`,
        },
      ]),
    );
  });
  discovery.listen(0, '127.0.0.1');
  await once(discovery, 'listening');
  const discoveryAddress = discovery.address();
  if (!discoveryAddress || typeof discoveryAddress === 'string') {
    throw new Error('Discovery benchmark failed to bind.');
  }

  return {
    port: discoveryAddress.port,
    counts: () => ({ connections, requests, discoveries }),
    close: async () => {
      for (const socket of cdp.clients) socket.terminate();
      await Promise.all([
        new Promise((resolve, reject) => cdp.close((error) => (error ? reject(error) : resolve()))),
        new Promise((resolve, reject) =>
          discovery.close((error) => (error ? reject(error) : resolve())),
        ),
      ]);
    },
  };
}

async function connectClient({ name, args, cwd, env, versionNegotiation }) {
  const client = new Client(
    { name: 'debug-electron-mcp-parity-benchmark', version: '1.0.0' },
    { versionNegotiation },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args,
    cwd,
    env,
    stderr: 'pipe',
  });
  const errors = [];
  transport.stderr?.on('data', (chunk) => errors.push(chunk.toString()));
  const connectMs = await timed(() => client.connect(transport));
  return { name, client, transport, connectMs, errors };
}

async function runScenario({ mobileRepo, samples, warmups, adapterDelayMs }) {
  const backend = await createElectronBackend(adapterDelayMs);
  const counterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-mcp-benchmark-'));
  const counterFile = path.join(counterDir, 'commands.json');
  const commonEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined),
  );

  const electron = await connectClient({
    name: 'debug-electron-mcp',
    args: ['--import', 'tsx', path.join(fixtures, 'electron-mcp-benchmark-server.mjs')],
    cwd: root,
    env: {
      ...commonEnvironment,
      ELECTRON_MCP_BENCHMARK_DISCOVERY_PORT: String(backend.port),
    },
    versionNegotiation: { mode: { pin: '2026-07-28' } },
  });
  const mobile = await connectClient({
    name: 'mobile-mcp',
    args: [path.join(fixtures, 'mobile-mcp-benchmark-server.mjs'), mobileRepo],
    cwd: root,
    env: {
      ...commonEnvironment,
      MCP_BENCHMARK_ADAPTER_DELAY_MS: String(adapterDelayMs),
      MOBILEMCP_DISABLE_TELEMETRY: '1',
      MOBILE_MCP_BENCHMARK_COUNTER_FILE: counterFile,
    },
    versionNegotiation: { mode: 'legacy' },
  });

  const listElectron = () => electron.client.listTools({}, { cacheMode: 'bypass' });
  const listMobile = () => mobile.client.listTools({}, { cacheMode: 'bypass' });
  const electronActions = [
    { kind: 'click', target: { kind: 'coordinates', x: 10, y: 20 } },
    { kind: 'type_text', text: 'parity' },
    { kind: 'press_key', key: 'Enter' },
    {
      kind: 'scroll',
      deltaY: 120,
      target: { kind: 'coordinates', x: 10, y: 20 },
    },
    { kind: 'open_url', url: 'https://example.test/' },
  ];
  const mobileActions = [
    ['mobile_click_on_screen_at_coordinates', { device: 'benchmark-device', x: 10, y: 20 }],
    ['mobile_type_keys', { device: 'benchmark-device', text: 'parity', submit: false }],
    ['mobile_press_button', { device: 'benchmark-device', button: 'ENTER' }],
    [
      'mobile_swipe_on_screen',
      { device: 'benchmark-device', direction: 'up', x: 10, y: 20, distance: 120 },
    ],
    ['mobile_open_url', { device: 'benchmark-device', url: 'https://example.test/' }],
  ];
  const callElectron = async (actions) => {
    const result = await electron.client.callTool({
      name: 'perform_electron_actions',
      arguments: { projectName: 'benchmark', actions },
    });
    assertToolResult(result, actions.length);
  };
  const callMobile = async ([name, args]) => {
    const result = await mobile.client.callTool({ name, arguments: args });
    assertToolResult(result);
  };
  const electronSeparate = async () => {
    for (const action of electronActions) await callElectron([action]);
  };
  const mobileSeparate = async () => {
    for (const action of mobileActions) await callMobile(action);
  };
  const electronBatch = () => callElectron(electronActions);
  const readElectronContext = async () => {
    const result = await electron.client.callTool({
      name: 'send_command_to_electron',
      arguments: { projectName: 'benchmark', command: 'get_title', args: {} },
    });
    assertToolResult(result);
  };
  const readMobileContext = async () => {
    const result = await mobile.client.callTool({
      name: 'mobile_get_foreground_app',
      arguments: { device: 'benchmark-device' },
    });
    assertToolResult(result);
  };

  let results;
  try {
    const [electronTools, mobileTools] = await Promise.all([listElectron(), listMobile()]);
    await Promise.all([repeat(warmups, listElectron), repeat(warmups, listMobile)]);
    const toolsList = await alternate(samples, listElectron, listMobile);

    await repeat(warmups, readElectronContext);
    await repeat(warmups, readMobileContext);
    const contextRead = await alternate(samples, readElectronContext, readMobileContext);

    await repeat(warmups, () => callElectron([electronActions[0]]));
    await repeat(warmups, () => callMobile(mobileActions[0]));
    const click = await alternate(
      samples,
      () => callElectron([electronActions[0]]),
      () => callMobile(mobileActions[0]),
    );

    await repeat(warmups, electronSeparate);
    await repeat(warmups, mobileSeparate);
    const fiveSeparate = await alternate(samples, electronSeparate, mobileSeparate);

    await repeat(warmups, electronBatch);
    await repeat(warmups, mobileSeparate);
    const electronBatchVsMobileSeparate = await alternate(samples, electronBatch, mobileSeparate);

    results = {
      adapterDelayMs,
      startup: {
        electronConnectMs: Number(electron.connectMs.toFixed(2)),
        mobileConnectMs: Number(mobile.connectMs.toFixed(2)),
        note: 'Informational only; protocol handshakes and wrapper module graphs differ.',
      },
      catalog: {
        electronTools: electronTools.tools.length,
        mobileTools: mobileTools.tools.length,
        electronBytes: Buffer.byteLength(JSON.stringify(electronTools)),
        mobileBytes: Buffer.byteLength(JSON.stringify(mobileTools)),
        latency: toolsList,
      },
      oneContextRead: contextRead,
      oneCoordinateClick: click,
      fiveSeparateEquivalentActions: {
        ...fiveSeparate,
        electronSpeedup: Number(
          (fiveSeparate.mobile.medianMs / fiveSeparate.electron.medianMs).toFixed(2),
        ),
      },
      electronBatchVsMobileSeparate: {
        electron: electronBatchVsMobileSeparate.electron,
        mobile: electronBatchVsMobileSeparate.mobile,
        rawSamplesMs: electronBatchVsMobileSeparate.rawSamplesMs,
        electronSpeedup: Number(
          (
            electronBatchVsMobileSeparate.mobile.medianMs /
            electronBatchVsMobileSeparate.electron.medianMs
          ).toFixed(2),
        ),
        mobileBatch: 'unsupported',
      },
    };
  } finally {
    await Promise.allSettled([electron.client.close(), mobile.client.close()]);
    await backend.close();
  }

  let mobileCommandCount;
  if (fs.existsSync(counterFile)) {
    mobileCommandCount = JSON.parse(fs.readFileSync(counterFile, 'utf8')).commandCount;
  }
  removeBenchmarkTempDirectory(counterDir);

  const expectedMobileCommands = (warmups + samples) * 3 * 2 + (warmups + samples) * 15 * 2;
  const expectedElectronRequests =
    1 + (warmups + samples) + (warmups + samples) * 3 + (warmups + samples) * 8 * 2;
  const electronCounts = backend.counts();
  if (mobileCommandCount !== expectedMobileCommands) {
    throw new Error(
      `mobilecli command count mismatch: ${mobileCommandCount}/${expectedMobileCommands}.`,
    );
  }
  if (
    electronCounts.connections !== 1 ||
    electronCounts.discoveries < 1 ||
    electronCounts.requests !== expectedElectronRequests
  ) {
    throw new Error(
      `Electron backend count mismatch: ${JSON.stringify(electronCounts)}, expected ${expectedElectronRequests} requests.`,
    );
  }
  return {
    ...results,
    adapterOperations: {
      electron: { ...electronCounts, expectedRequests: expectedElectronRequests },
      mobile: { commands: mobileCommandCount, expectedCommands: expectedMobileCommands },
    },
  };
}

const options = parseArgs(process.argv.slice(2));
const mobile = ensureMobileMcp(options.mobileRepo);
const scenarios = [];
for (const adapterDelayMs of options.adapterDelays) {
  scenarios.push(
    await runScenario({
      mobileRepo: mobile.repo,
      samples: options.samples,
      warmups: options.warmups,
      adapterDelayMs,
    }),
  );
}

const report = {
  benchmark: 'debug-electron-mcp vs mobile-next/mobile-mcp',
  measuredAt: new Date().toISOString(),
  machine: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    npm: runNpm(['--version'], root),
  },
  method: {
    transport: 'stdio through @modelcontextprotocol/client 2.0.0',
    samples: options.samples,
    warmups: options.warmups,
    order: 'alternated for each paired sample',
    backend: 'real server paths with CDP and mobilecli replaced only at the platform boundary',
  },
  revisions: {
    debugElectronMcpHead: run('git', ['rev-parse', 'HEAD'], root),
    debugElectronMcpWorkingTreeDirty:
      run('git', ['status', '--porcelain', '--untracked-files=all'], root) !== '',
    debugElectronMcpRuntimeSha256: contentHash([
      path.join(root, 'src'),
      path.join(root, 'package.json'),
      path.join(root, 'package-lock.json'),
      path.join(root, 'scripts', 'benchmark-mobile-parity.mjs'),
      fixtures,
    ]),
    mobileMcp: mobile.commit,
    mobileMcpRepository: MOBILE_MCP_REPOSITORY,
  },
  scenarios,
};
const reportJson = JSON.stringify(report, null, 2);
if (options.output) {
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${reportJson}\n`);
}
console.log(reportJson);
