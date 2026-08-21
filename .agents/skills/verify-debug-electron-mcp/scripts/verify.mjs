#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const DEMO_ROOT = path.join(REPO_ROOT, 'examples', 'demo-app');
const DIST_ENTRY = path.join(REPO_ROOT, 'dist', 'index.js');
const WEBPACK_ENTRY = path.join(REPO_ROOT, 'node_modules', 'webpack', 'bin', 'webpack.js');
const RUNS_ROOT = path.join(REPO_ROOT, '.verification', 'debug-electron-mcp');
const DEBUG_PORT = 9222;
const EXPECTED_TITLE = 'MCP Demo App';
const REQUIRED_TOOLS = [
  'get_electron_window_info',
  'take_screenshot',
  'send_command_to_electron',
  'list_electron_windows',
  'read_electron_logs',
  'register_project',
  'unregister_project',
  'list_projects',
];

function parseCli(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  const positionals = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = tokens[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options, positionals };
}

function requireString(options, key) {
  const value = options[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required --${key} value.`);
  }
  return value;
}

function validateName(value, label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) {
    throw new Error(`${label} must use letters, numbers, dots, underscores, or hyphens.`);
  }
  return value;
}

function getRunPaths(runId) {
  const safeRunId = validateName(runId, 'run-id');
  const runDir = path.join(RUNS_ROOT, safeRunId);
  return {
    runId: safeRunId,
    runDir,
    evidenceDir: path.join(runDir, 'evidence'),
    statePath: path.join(runDir, 'state.json'),
  };
}

function ensureRunDirs(paths) {
  mkdirSync(paths.evidenceDir, { recursive: true });
}

function readState(paths) {
  if (!existsSync(paths.statePath)) {
    throw new Error(`No active verification state for run ${paths.runId}. Launch it first.`);
  }
  return JSON.parse(readFileSync(paths.statePath, 'utf8'));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(800);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function readTargets() {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`, {
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) {
    throw new Error(`CDP target request returned HTTP ${response.status}.`);
  }
  const targets = await response.json();
  if (!Array.isArray(targets)) {
    throw new Error('CDP target response was not an array.');
  }
  return targets;
}

function findDemoTarget(targets) {
  return targets.find(
    (target) =>
      target?.type === 'page' &&
      target?.title === EXPECTED_TITLE &&
      !String(target?.url).startsWith('devtools://'),
  );
}

async function waitForDemoTarget(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const target = findDemoTarget(await readTargets());
      if (target) return target;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Demo target did not become ready on port ${DEBUG_PORT}.${lastError ? ` Last error: ${lastError.message}` : ''}`,
  );
}

function buildServer(logPath) {
  if (!existsSync(WEBPACK_ENTRY)) {
    throw new Error(`Missing ${WEBPACK_ENTRY}. Install root dependencies first.`);
  }

  const result = spawnSync(
    process.execPath,
    [WEBPACK_ENTRY, '--config', 'webpack.config.ts', '--mode', 'production'],
    { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true },
  );
  writeFileSync(logPath, `${result.stdout ?? ''}${result.stderr ?? ''}`, 'utf8');

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Webpack failed with exit code ${result.status}. Read ${logPath}.`);
  }
  if (!existsSync(DIST_ENTRY)) {
    throw new Error(`Build completed without creating ${DIST_ENTRY}.`);
  }
}

function resolveElectronExecutable() {
  const packagePath = path.join(DEMO_ROOT, 'package.json');
  const requireFromDemo = createRequire(packagePath);
  const executable = requireFromDemo('electron');
  if (typeof executable !== 'string' || !existsSync(executable)) {
    throw new Error(
      'The demo Electron executable is missing. Install examples/demo-app dependencies first.',
    );
  }
  return executable;
}

function killTrackedProcess(pid) {
  if (!isPidAlive(pid)) return { alreadyStopped: true };

  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0 && isPidAlive(pid)) {
      throw new Error(`Could not stop PID ${pid}: ${result.stderr || result.stdout}`);
    }
    return { alreadyStopped: false, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
  return { alreadyStopped: false };
}

async function launch(runId) {
  const paths = getRunPaths(runId);
  ensureRunDirs(paths);

  if (existsSync(paths.statePath)) {
    const oldState = JSON.parse(readFileSync(paths.statePath, 'utf8'));
    if (isPidAlive(oldState.pid)) {
      throw new Error(
        `Run ${paths.runId} already owns live PID ${oldState.pid}. Clean it up first.`,
      );
    }
    rmSync(paths.statePath, { force: true });
  }

  if (await isPortOpen(DEBUG_PORT)) {
    throw new Error(
      `Port ${DEBUG_PORT} is already in use. Refusing to drive or stop an instance this run did not start.`,
    );
  }

  const buildLog = path.join(paths.evidenceDir, 'build.log');
  buildServer(buildLog);
  const demoLog = path.join(paths.evidenceDir, 'demo.log');
  const logFd = openSync(demoLog, 'a');
  const executable = resolveElectronExecutable();
  const electronEnvironment = safeEnvironment();
  delete electronEnvironment.ELECTRON_RUN_AS_NODE;
  electronEnvironment.NODE_ENV = 'development';
  const child = spawn(executable, [DEMO_ROOT, '--dev'], {
    cwd: DEMO_ROOT,
    detached: true,
    env: electronEnvironment,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
  });
  closeSync(logFd);

  if (!child.pid) {
    throw new Error('Electron did not return a process ID.');
  }
  child.unref();

  const state = {
    runId: paths.runId,
    pid: child.pid,
    port: DEBUG_PORT,
    startedAt: new Date().toISOString(),
    portWasFreeBeforeLaunch: true,
    demoRoot: DEMO_ROOT,
    buildEntry: DIST_ENTRY,
  };
  writeJson(paths.statePath, state);

  try {
    const target = await waitForDemoTarget();
    const readyState = {
      ...state,
      targetId: target.id,
      targetTitle: target.title,
      targetUrl: target.url,
      readyAt: new Date().toISOString(),
    };
    writeJson(paths.statePath, readyState);
    console.log(
      JSON.stringify({ status: 'ready', ...readyState, evidenceDir: paths.evidenceDir }, null, 2),
    );
  } catch (error) {
    killTrackedProcess(child.pid);
    rmSync(paths.statePath, { force: true });
    throw error;
  }
}

function safeEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => typeof value === 'string'),
  );
}

async function withMcpClient(operation) {
  if (!existsSync(DIST_ENTRY)) {
    throw new Error(`Missing ${DIST_ENTRY}. Run launch to build the server.`);
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [DIST_ENTRY],
    cwd: path.parse(REPO_ROOT).root,
    env: safeEnvironment(),
    stderr: 'pipe',
  });
  let serverStderr = '';
  transport.stderr?.on('data', (chunk) => {
    serverStderr += chunk.toString();
  });
  const client = new Client({ name: 'verify-debug-electron-mcp', version: '1.0.0' });

  try {
    await client.connect(transport);
    return await operation({ client, serverStderr: () => serverStderr });
  } finally {
    await client.close().catch(() => transport.close());
  }
}

function resultText(result) {
  if (!result || !Array.isArray(result.content)) return '';
  return result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

function assertToolSuccess(name, result) {
  const text = resultText(result);
  if (result?.isError) {
    throw new Error(`${name} failed: ${text}`);
  }
  return text;
}

function sanitizeResult(result) {
  if (!result || !Array.isArray(result.content)) return result;
  return {
    ...result,
    content: result.content.map((item) =>
      item.type === 'image'
        ? { type: 'image', mimeType: item.mimeType, encodedCharacters: item.data.length }
        : item,
    ),
  };
}

async function currentTarget(state) {
  const target = findDemoTarget(await readTargets());
  if (!target)
    throw new Error(`The ${EXPECTED_TITLE} target is not available on port ${DEBUG_PORT}.`);
  if (state.targetId && state.targetId !== target.id) {
    return target;
  }
  return target;
}

async function buildDoctorReport(paths, state) {
  if (!isPidAlive(state.pid)) {
    throw new Error(`Tracked Electron PID ${state.pid} is not running.`);
  }
  const target = await currentTarget(state);

  const mcp = await withMcpClient(async ({ client, serverStderr }) => {
    const serverVersion = client.getServerVersion();
    const listed = await client.listTools();
    const windows = await client.callTool({ name: 'list_electron_windows', arguments: {} });
    const windowText = assertToolSuccess('list_electron_windows', windows);
    const toolNames = listed.tools.map((tool) => tool.name);
    const missingTools = REQUIRED_TOOLS.filter((name) => !toolNames.includes(name));
    if (missingTools.length > 0) {
      throw new Error(`MCP server is missing tools: ${missingTools.join(', ')}`);
    }
    if (!windowText.includes(EXPECTED_TITLE) || !windowText.includes(`port: ${DEBUG_PORT}`)) {
      throw new Error(
        `MCP window discovery did not report ${EXPECTED_TITLE} on port ${DEBUG_PORT}.`,
      );
    }
    return {
      serverVersion,
      toolNames,
      windowResult: sanitizeResult(windows),
      serverStderr: serverStderr(),
    };
  });

  return {
    status: 'healthy',
    checkedAt: new Date().toISOString(),
    runId: paths.runId,
    trackedPid: state.pid,
    pidAlive: true,
    port: DEBUG_PORT,
    portWasFreeBeforeLaunch: state.portWasFreeBeforeLaunch,
    target: { id: target.id, title: target.title, type: target.type, url: target.url },
    authentication: 'not used by the local stdio and CDP verification path',
    ...mcp,
  };
}

async function doctor(runId) {
  const paths = getRunPaths(runId);
  const state = readState(paths);
  const report = await buildDoctorReport(paths, state);
  writeJson(path.join(paths.evidenceDir, 'doctor.json'), report);
  console.log(JSON.stringify(report, null, 2));
}

async function callTool(runId, tool, rawArguments, evidenceName) {
  const paths = getRunPaths(runId);
  const state = readState(paths);
  const target = await currentTarget(state);
  let args;
  try {
    args = JSON.parse(rawArguments);
  } catch (error) {
    throw new Error(`--arguments must be valid JSON: ${error.message}`);
  }
  if (!args || Array.isArray(args) || typeof args !== 'object') {
    throw new Error('--arguments must decode to a JSON object.');
  }
  if (
    (tool === 'send_command_to_electron' || tool === 'take_screenshot') &&
    !args.targetId &&
    !args.windowTitle
  ) {
    args.targetId = target.id;
  }

  const result = await withMcpClient(({ client }) =>
    client.callTool({ name: tool, arguments: args }),
  );
  assertToolSuccess(tool, result);
  const record = {
    calledAt: new Date().toISOString(),
    runId: paths.runId,
    tool,
    arguments: args,
    result: sanitizeResult(result),
  };

  if (evidenceName) {
    const safeName = validateName(evidenceName, 'evidence');
    writeJson(path.join(paths.evidenceDir, safeName), record);
  }
  console.log(JSON.stringify(record, null, 2));
}

function assertPng(filePath) {
  if (!existsSync(filePath) || statSync(filePath).size < 8) {
    throw new Error(`Screenshot was not written to ${filePath}.`);
  }
  const signature = readFileSync(filePath).subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`${filePath} is not a PNG file.`);
  }
}

async function screenshot(runId, name) {
  const paths = getRunPaths(runId);
  const state = readState(paths);
  const target = await currentTarget(state);
  const safeName = validateName(name, 'name');
  if (!safeName.endsWith('.png')) {
    throw new Error('Screenshot --name must end with .png.');
  }
  const outputPath = path.join(paths.evidenceDir, safeName);
  const result = await withMcpClient(({ client }) =>
    client.callTool({
      name: 'take_screenshot',
      arguments: { targetId: target.id, outputPath },
    }),
  );
  assertToolSuccess('take_screenshot', result);
  assertPng(outputPath);
  const record = {
    capturedAt: new Date().toISOString(),
    runId: paths.runId,
    targetId: target.id,
    outputPath,
    result: sanitizeResult(result),
  };
  writeJson(path.join(paths.evidenceDir, `${safeName}.json`), record);
  console.log(JSON.stringify(record, null, 2));
}

async function proveCounter(runId) {
  const paths = getRunPaths(runId);
  const state = readState(paths);
  const doctorReport = await buildDoctorReport(paths, state);
  writeJson(path.join(paths.evidenceDir, 'doctor.json'), doctorReport);
  const target = await currentTarget(state);
  const beforePath = path.join(paths.evidenceDir, 'counter-before.png');
  const afterPath = path.join(paths.evidenceDir, 'counter-after.png');

  const proof = await withMcpClient(async ({ client }) => {
    const invoke = async (name, arguments_) => {
      const result = await client.callTool({ name, arguments: arguments_ });
      const text = assertToolSuccess(name, result);
      return { text, result: sanitizeResult(result) };
    };
    const command = (commandName, args) =>
      invoke('send_command_to_electron', { command: commandName, args, targetId: target.id });

    const reset = await command('click_by_selector', { selector: '[data-testid="reset-button"]' });
    const before = await command('eval', {
      code: "document.getElementById('counter-value')?.textContent",
    });
    const beforeShot = await invoke('take_screenshot', {
      targetId: target.id,
      outputPath: beforePath,
    });
    const increment = await command('click_by_selector', {
      selector: '[data-testid="increment-button"]',
    });
    const after = await command('eval', {
      code: "document.getElementById('counter-value')?.textContent",
    });
    const eventLog = await command('eval', {
      code: "document.getElementById('event-log')?.textContent",
    });
    const afterShot = await invoke('take_screenshot', {
      targetId: target.id,
      outputPath: afterPath,
    });

    if (!before.text.includes('"0"')) throw new Error(`Counter did not reset to 0: ${before.text}`);
    if (!after.text.includes('"1"'))
      throw new Error(`Counter did not increment to 1: ${after.text}`);
    if (!eventLog.text.includes('Counter incremented to 1')) {
      throw new Error(`Event log did not record the increment: ${eventLog.text}`);
    }

    return { reset, before, beforeShot, increment, after, eventLog, afterShot };
  });

  assertPng(beforePath);
  assertPng(afterPath);
  const transcript = {
    feature: 'counter-state',
    runId: paths.runId,
    completedAt: new Date().toISOString(),
    target: { id: target.id, title: target.title, url: target.url },
    userPath: [
      'Click the visible Reset Counter control through MCP.',
      'Read the rendered counter value.',
      'Capture the before state.',
      'Click the visible + Increment control through MCP.',
      'Read the rendered counter and event log.',
      'Capture the resulting state.',
    ],
    screenshots: { before: beforePath, after: afterPath },
    calls: proof,
  };
  writeJson(path.join(paths.evidenceDir, 'counter-proof.json'), transcript);
  console.log(
    JSON.stringify(
      {
        status: 'proved',
        feature: 'counter-state',
        evidence: path.join(paths.evidenceDir, 'counter-proof.json'),
        screenshots: transcript.screenshots,
      },
      null,
      2,
    ),
  );
}

async function waitForPortToClose(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(DEBUG_PORT))) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function cleanup(runId) {
  const paths = getRunPaths(runId);
  ensureRunDirs(paths);
  let state;
  if (existsSync(paths.statePath)) {
    state = JSON.parse(readFileSync(paths.statePath, 'utf8'));
  }

  const processResult = state
    ? killTrackedProcess(state.pid)
    : { alreadyStopped: true, noStateFile: true };
  const portClosed = await waitForPortToClose();
  if (!portClosed) {
    throw new Error(
      `Port ${DEBUG_PORT} is still open after stopping the tracked process. Do not kill any other process.`,
    );
  }
  rmSync(paths.statePath, { force: true });
  const evidenceFiles = existsSync(paths.evidenceDir) ? readdirSync(paths.evidenceDir).sort() : [];
  const report = {
    status: 'clean',
    cleanedAt: new Date().toISOString(),
    runId: paths.runId,
    trackedPid: state?.pid ?? null,
    processResult,
    portClosed,
    evidenceDir: paths.evidenceDir,
    evidenceFiles,
  };
  writeJson(path.join(paths.evidenceDir, 'cleanup.json'), report);
  console.log(JSON.stringify(report, null, 2));
}

function usage() {
  console.log(`Usage:
  node ${path.relative(REPO_ROOT, fileURLToPath(import.meta.url))} launch --run-id <id>
  node ${path.relative(REPO_ROOT, fileURLToPath(import.meta.url))} doctor --run-id <id>
  node ${path.relative(REPO_ROOT, fileURLToPath(import.meta.url))} call --run-id <id> --tool <name> --arguments <json> [--evidence <file.json>]
  node ${path.relative(REPO_ROOT, fileURLToPath(import.meta.url))} screenshot --run-id <id> --name <file.png>
  node ${path.relative(REPO_ROOT, fileURLToPath(import.meta.url))} prove-counter --run-id <id>
  node ${path.relative(REPO_ROOT, fileURLToPath(import.meta.url))} cleanup --run-id <id>`);
}

async function main() {
  const { command, options } = parseCli(process.argv.slice(2));
  if (!command || command === 'help' || options.help) {
    usage();
    return;
  }
  const runId = requireString(options, 'run-id');

  switch (command) {
    case 'launch':
      await launch(runId);
      break;
    case 'doctor':
      await doctor(runId);
      break;
    case 'call':
      await callTool(
        runId,
        requireString(options, 'tool'),
        requireString(options, 'arguments'),
        typeof options.evidence === 'string' ? options.evidence : undefined,
      );
      break;
    case 'screenshot':
      await screenshot(runId, requireString(options, 'name'));
      break;
    case 'prove-counter':
      await proveCounter(runId);
      break;
    case 'cleanup':
      await cleanup(runId);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(`verify-debug-electron-mcp: ${error.message}`);
  process.exitCode = 1;
});
