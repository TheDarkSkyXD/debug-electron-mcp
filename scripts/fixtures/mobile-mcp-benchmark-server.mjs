import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const mobileRepo = path.resolve(process.argv[2] ?? '');
const adapterDelayMs = Number(process.env.MCP_BENCHMARK_ADAPTER_DELAY_MS ?? '0');
const counterFile = process.env.MOBILE_MCP_BENCHMARK_COUNTER_FILE;

if (!mobileRepo || !fs.existsSync(path.join(mobileRepo, 'lib', 'server.js'))) {
  throw new Error('Pass a built mobile-mcp repository as the first argument.');
}
if (!Number.isInteger(adapterDelayMs) || adapterDelayMs < 0 || adapterDelayMs > 1000) {
  throw new Error('MCP_BENCHMARK_ADAPTER_DELAY_MS must be an integer from 0 through 1000.');
}

process.env.MOBILEMCP_DISABLE_TELEMETRY = '1';

const mobilecliModule = await import(
  pathToFileURL(path.join(mobileRepo, 'lib', 'mobilecli.js')).href
);
const { Mobilecli } = mobilecliModule;
let commandCount = 0;

function delayAdapter() {
  const deadline = performance.now() + adapterDelayMs;
  while (performance.now() < deadline) {
    // A synchronous mobilecli command blocks until the adapter responds.
  }
}

Mobilecli.prototype.executeCommand = function executeCommand(args) {
  commandCount += 1;
  delayAdapter();

  if (args.length === 1 && args[0] === '--version') return 'mobilecli version benchmark';
  if (args[0] === 'devices') {
    return JSON.stringify({
      status: 'ok',
      data: {
        devices: [
          {
            id: 'benchmark-device',
            name: 'Benchmark device',
            platform: 'android',
            type: 'emulator',
            version: '1',
            state: 'online',
          },
        ],
      },
    });
  }
  if (args[0] === 'apps' && args[1] === 'foreground') {
    return JSON.stringify({
      status: 'ok',
      data: { packageName: 'benchmark.app', appName: 'Benchmark' },
    });
  }
  if (
    (args[0] === 'io' && ['tap', 'text', 'button', 'swipe'].includes(args[1])) ||
    args[0] === 'url'
  ) {
    return '';
  }

  throw new Error(`Unexpected benchmark mobilecli command: ${JSON.stringify(args)}`);
};

let recorded = false;
function recordCommandCount() {
  if (recorded || !counterFile) return;
  recorded = true;
  fs.writeFileSync(counterFile, JSON.stringify({ commandCount }));
}

process.once('exit', recordCommandCount);

async function main() {
  const serverModule = await import(pathToFileURL(path.join(mobileRepo, 'lib', 'server.js')).href);
  const stdioModule = await import(
    pathToFileURL(
      path.join(
        mobileRepo,
        'node_modules',
        '@modelcontextprotocol',
        'sdk',
        'dist',
        'cjs',
        'server',
        'stdio.js',
      ),
    ).href
  );
  const server = serverModule.createMcpServer();
  const transport = new stdioModule.StdioServerTransport();
  await server.connect(transport);

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    recordCommandCount();
    await server.close();
    process.exit();
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
}

void main();
