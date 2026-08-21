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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(SCRIPT_FILE), '..');
const DEFAULT_REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const DEFAULT_PROFILE = path.join('.agents', 'verify-electron', 'profile.json');
const DEFAULT_EVIDENCE_ROOT = path.join('.verification', 'electron');

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
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value)) {
    throw new Error(`${label} must use letters, numbers, dots, underscores, or hyphens.`);
  }
  return value;
}

function asObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value;
}

function asNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function asRelativePath(value, label) {
  const relativePath = asNonEmptyString(value, label);
  if (path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be relative to the repository root.`);
  }
  return relativePath;
}

function resolveInside(root, relativePath, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relation = path.relative(resolvedRoot, resolvedPath);
  if (relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
    throw new Error(`${label} resolves outside the repository root.`);
  }
  return resolvedPath;
}

function resolveRepoRoot(options) {
  if (typeof options.root === 'string') return path.resolve(process.cwd(), options.root);
  return DEFAULT_REPO_ROOT;
}

function validateProfile(raw, repoRoot, profilePath) {
  const profile = asObject(raw, 'profile');
  if (profile.version !== 1) throw new Error('profile.version must be 1.');

  const projectName = asNonEmptyString(profile.projectName, 'profile.projectName');
  if (
    projectName !== projectName.trim() ||
    projectName.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(projectName)
  ) {
    throw new Error(
      'profile.projectName must be at most 100 characters with no surrounding whitespace or control characters.',
    );
  }

  const port = profile.port;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('profile.port must be an integer from 1024 through 65535.');
  }

  const launch = asObject(profile.launch, 'profile.launch');
  const command = asNonEmptyString(launch.command, 'profile.launch.command');
  const args = launch.args ?? [];
  if (!Array.isArray(args) || args.some((item) => typeof item !== 'string')) {
    throw new Error('profile.launch.args must be an array of strings.');
  }
  const cwd = asRelativePath(launch.cwd ?? '.', 'profile.launch.cwd');
  const launchCwd = resolveInside(repoRoot, cwd, 'profile.launch.cwd');
  if (!existsSync(launchCwd) || !statSync(launchCwd).isDirectory()) {
    throw new Error(`profile.launch.cwd does not exist: ${launchCwd}`);
  }

  const env = launch.env ?? {};
  asObject(env, 'profile.launch.env');
  if (
    Object.entries(env).some(
      ([key, value]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string',
    )
  ) {
    throw new Error('profile.launch.env must map portable environment names to string values.');
  }

  const readyTimeoutMs = launch.readyTimeoutMs ?? 30000;
  if (!Number.isInteger(readyTimeoutMs) || readyTimeoutMs < 1000 || readyTimeoutMs > 180000) {
    throw new Error('profile.launch.readyTimeoutMs must be an integer from 1000 through 180000.');
  }
  if (
    launch.stripElectronRunAsNode !== undefined &&
    typeof launch.stripElectronRunAsNode !== 'boolean'
  ) {
    throw new Error('profile.launch.stripElectronRunAsNode must be a boolean.');
  }

  const target = asObject(profile.target, 'profile.target');
  const title = target.title;
  const titleIncludes = target.titleIncludes;
  const urlIncludes = target.urlIncludes;
  for (const [label, value] of [
    ['profile.target.title', title],
    ['profile.target.titleIncludes', titleIncludes],
    ['profile.target.urlIncludes', urlIncludes],
  ]) {
    if (value !== undefined) asNonEmptyString(value, label);
  }
  if (title === undefined && titleIncludes === undefined && urlIncludes === undefined) {
    throw new Error('profile.target requires title, titleIncludes, or urlIncludes.');
  }

  const evidenceRelative = asRelativePath(
    profile.evidenceRoot ?? DEFAULT_EVIDENCE_ROOT,
    'profile.evidenceRoot',
  );
  const evidenceRoot = resolveInside(repoRoot, evidenceRelative, 'profile.evidenceRoot');

  return {
    version: 1,
    projectName,
    port,
    launch: {
      command,
      args,
      cwd,
      cwdPath: launchCwd,
      env,
      readyTimeoutMs,
      stripElectronRunAsNode: launch.stripElectronRunAsNode !== false,
    },
    target: { title, titleIncludes, urlIncludes },
    evidenceRelative,
    evidenceRoot,
    profilePath,
  };
}

function loadContext(options) {
  const repoRoot = resolveRepoRoot(options);
  const profileRelative =
    typeof options.profile === 'string'
      ? asRelativePath(options.profile, '--profile')
      : DEFAULT_PROFILE;
  const profilePath = resolveInside(repoRoot, profileRelative, '--profile');
  if (!existsSync(profilePath)) {
    throw new Error(
      `Missing ${profilePath}. Bootstrap .agents/verify-electron/profile.json from the skill instructions.`,
    );
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(profilePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${profilePath}: ${error.message}`);
  }
  return { repoRoot, profile: validateProfile(raw, repoRoot, profilePath) };
}

function getRunPaths(profile, runId) {
  const safeRunId = validateName(runId, 'run-id');
  const runDir = path.join(profile.evidenceRoot, safeRunId);
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

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readState(paths) {
  if (!existsSync(paths.statePath)) {
    throw new Error(`No active verification state for run ${paths.runId}. Launch it first.`);
  }
  let state;
  try {
    state = JSON.parse(readFileSync(paths.statePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${paths.statePath}: ${error.message}`);
  }
  if (!Number.isInteger(state.pid) || state.pid < 1) {
    throw new Error(`State for run ${paths.runId} does not contain a valid PID.`);
  }
  return state;
}

function safeEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => typeof value === 'string'),
  );
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

async function readTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw new Error(`CDP target request returned HTTP ${response.status}.`);
  const targets = await response.json();
  if (!Array.isArray(targets)) throw new Error('CDP target response was not an array.');
  return targets;
}

function publicTarget(target) {
  return {
    id: target?.id,
    title: target?.title,
    type: target?.type,
    url: target?.url,
  };
}

function targetMatches(target, rules) {
  if (target?.type !== 'page' || String(target?.url).startsWith('devtools://')) return false;
  if (rules.title !== undefined && target?.title !== rules.title) return false;
  if (
    rules.titleIncludes !== undefined &&
    !String(target?.title).toLowerCase().includes(rules.titleIncludes.toLowerCase())
  ) {
    return false;
  }
  if (rules.urlIncludes !== undefined && !String(target?.url).includes(rules.urlIncludes)) {
    return false;
  }
  return true;
}

function selectTarget(targets, rules) {
  const matches = targets.filter((target) => targetMatches(target, rules));
  if (matches.length !== 1) {
    const visible = targets
      .filter((target) => target?.type === 'page' && !String(target?.url).startsWith('devtools://'))
      .map(publicTarget);
    throw new Error(
      `Expected exactly one target matching the profile, found ${matches.length}. Visible targets: ${JSON.stringify(visible)}`,
    );
  }
  return matches[0];
}

async function waitForTarget(profile) {
  const deadline = Date.now() + profile.launch.readyTimeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return selectTarget(await readTargets(profile.port), profile.target);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Target did not become ready on port ${profile.port}.${lastError ? ` Last error: ${lastError.message}` : ''}`,
  );
}

function assertInsideRoot(repoRoot, filePath, label) {
  const relation = path.relative(path.resolve(repoRoot), path.resolve(filePath));
  if (relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
    throw new Error(`${label} resolves outside the repository root.`);
  }
}

function resolveLaunchCommand(command, cwd, args, repoRoot) {
  const looksLikePath = command.includes('/') || command.includes('\\') || command.startsWith('.');
  if (looksLikePath) {
    const resolved = path.resolve(cwd, command);
    const candidates = process.platform === 'win32'
      ? [`${resolved}.exe`, `${resolved}.cmd`, `${resolved}.bat`, resolved]
      : [resolved];
    const match = candidates.find((candidate) => existsSync(candidate));
    if (!match) throw new Error(`Launch command does not exist: ${resolved}`);
    assertInsideRoot(repoRoot, match, 'profile.launch.command');
    const shell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(match);
    if (shell) {
      const relativeCommand = path.relative(cwd, match);
      validateWindowsShellTokens([relativeCommand, ...args]);
      return {
        command: [relativeCommand, ...args].map(quoteWindowsShellToken).join(' '),
        args: [],
        shell: true,
        displayCommand: match,
      };
    }
    return { command: match, args, shell: false, displayCommand: match };
  }
  if (process.platform === 'win32' && ['npm', 'npx', 'pnpm', 'yarn'].includes(command)) {
    validateWindowsShellTokens([command, ...args]);
    return {
      command: [`${command}.cmd`, ...args].map(quoteWindowsShellToken).join(' '),
      args: [],
      shell: true,
      displayCommand: `${command}.cmd`,
    };
  }
  return { command, args, shell: false, displayCommand: command };
}

function validateWindowsShellTokens(tokens) {
  const unsafe = tokens.find((token) => /[&|<>^%!()"\r\n]/.test(token));
  if (unsafe !== undefined) {
    throw new Error(
      `Windows command wrappers do not accept shell metacharacters: ${unsafe}. Put complex logic in a repository-owned script.`,
    );
  }
}

function quoteWindowsShellToken(token) {
  return /\s/.test(token) ? `"${token}"` : token;
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

async function waitForPortToClose(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function launch(context, runId) {
  const { profile } = context;
  const paths = getRunPaths(profile, runId);
  ensureRunDirs(paths);

  if (existsSync(paths.statePath)) {
    const previous = readState(paths);
    if (isPidAlive(previous.pid)) {
      throw new Error(`Run ${paths.runId} already owns live PID ${previous.pid}. Clean it up first.`);
    }
    rmSync(paths.statePath, { force: true });
  }
  if (await isPortOpen(profile.port)) {
    throw new Error(
      `Port ${profile.port} is already in use. Refusing to drive or stop an instance this run did not start.`,
    );
  }

  const appLog = path.join(paths.evidenceDir, 'app.log');
  const logFd = openSync(appLog, 'a');
  const environment = { ...safeEnvironment(), ...profile.launch.env };
  if (profile.launch.stripElectronRunAsNode) delete environment.ELECTRON_RUN_AS_NODE;
  const invocation = resolveLaunchCommand(
    profile.launch.command,
    profile.launch.cwdPath,
    profile.launch.args,
    context.repoRoot,
  );
  const child = spawn(invocation.command, invocation.args, {
    cwd: profile.launch.cwdPath,
    detached: true,
    env: environment,
    shell: invocation.shell,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
  });
  closeSync(logFd);
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  if (!child.pid) throw new Error('The launch command did not return a process ID.');
  child.unref();

  const state = {
    runId: paths.runId,
    pid: child.pid,
    port: profile.port,
    projectName: profile.projectName,
    profilePath: profile.profilePath,
    command: invocation.displayCommand,
    args: profile.launch.args,
    cwd: profile.launch.cwdPath,
    startedAt: new Date().toISOString(),
    portWasFreeBeforeLaunch: true,
  };
  writeJson(paths.statePath, state);

  try {
    const target = await waitForTarget(profile);
    const readyState = {
      ...state,
      target: publicTarget(target),
      readyAt: new Date().toISOString(),
    };
    writeJson(paths.statePath, readyState);
    console.log(
      JSON.stringify(
        { status: 'cdp-ready', ...readyState, evidenceDir: paths.evidenceDir },
        null,
        2,
      ),
    );
  } catch (error) {
    killTrackedProcess(child.pid);
    rmSync(paths.statePath, { force: true });
    throw error;
  }
}

async function doctor(context, runId) {
  const { profile } = context;
  const paths = getRunPaths(profile, runId);
  const state = readState(paths);
  if (state.port !== profile.port || state.projectName !== profile.projectName) {
    throw new Error('The active run state does not match the current project profile.');
  }
  if (!isPidAlive(state.pid)) throw new Error(`Tracked PID ${state.pid} is not running.`);
  const target = selectTarget(await readTargets(profile.port), profile.target);
  const report = {
    status: 'cdp-ready',
    checkedAt: new Date().toISOString(),
    runId: paths.runId,
    projectName: profile.projectName,
    trackedPid: state.pid,
    pidAlive: true,
    port: profile.port,
    portWasFreeBeforeLaunch: state.portWasFreeBeforeLaunch,
    target: publicTarget(target),
    evidenceDir: paths.evidenceDir,
    nextRequiredCheck: `Use Debug Electron MCP list_electron_windows with projectName=${profile.projectName} and confirm this target ID.`,
  };
  writeJson(path.join(paths.evidenceDir, 'doctor.json'), report);
  console.log(JSON.stringify(report, null, 2));
}

async function probe(portValue) {
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('--port must be an integer from 1024 through 65535.');
  }
  const targets = (await readTargets(port)).map(publicTarget);
  console.log(JSON.stringify({ status: 'reachable', port, targets }, null, 2));
}

function evidencePath(context, runId, name) {
  const paths = getRunPaths(context.profile, runId);
  ensureRunDirs(paths);
  const safeName = validateName(name, 'name');
  console.log(path.join(paths.evidenceDir, safeName));
}

function assertPng(context, runId, name) {
  const paths = getRunPaths(context.profile, runId);
  const safeName = validateName(name, 'name');
  if (!safeName.toLowerCase().endsWith('.png')) throw new Error('--name must end with .png.');
  const filePath = path.join(paths.evidenceDir, safeName);
  if (!existsSync(filePath) || statSync(filePath).size < 8) {
    throw new Error(`Screenshot was not written to ${filePath}.`);
  }
  const signature = readFileSync(filePath).subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${filePath} is not a PNG file.`);
  console.log(JSON.stringify({ status: 'valid-png', path: filePath, bytes: statSync(filePath).size }, null, 2));
}

function record(context, runId, name, rawData) {
  const paths = getRunPaths(context.profile, runId);
  ensureRunDirs(paths);
  const safeName = validateName(name, 'name');
  if (!safeName.toLowerCase().endsWith('.json')) throw new Error('--name must end with .json.');
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (error) {
    throw new Error(`--data must be valid JSON: ${error.message}`);
  }
  const outputPath = path.join(paths.evidenceDir, safeName);
  writeJson(outputPath, { recordedAt: new Date().toISOString(), runId: paths.runId, data });
  console.log(JSON.stringify({ status: 'recorded', path: outputPath }, null, 2));
}

async function cleanup(context, runId) {
  const { profile } = context;
  const paths = getRunPaths(profile, runId);
  ensureRunDirs(paths);
  const state = existsSync(paths.statePath) ? readState(paths) : undefined;
  if (state && (state.port !== profile.port || state.projectName !== profile.projectName)) {
    throw new Error('The active run state does not match the current project profile.');
  }
  const processResult = state
    ? killTrackedProcess(state.pid)
    : { alreadyStopped: true, noStateFile: true };
  const portClosed = await waitForPortToClose(profile.port);
  if (!portClosed) {
    throw new Error(
      `Port ${profile.port} remains open after stopping the tracked process. Refusing to kill an untracked process.`,
    );
  }
  rmSync(paths.statePath, { force: true });
  const report = {
    status: 'clean',
    cleanedAt: new Date().toISOString(),
    runId: paths.runId,
    trackedPid: state?.pid ?? null,
    processResult,
    portClosed,
    evidenceDir: paths.evidenceDir,
    evidenceFiles: existsSync(paths.evidenceDir) ? readdirSync(paths.evidenceDir).sort() : [],
  };
  writeJson(path.join(paths.evidenceDir, 'cleanup.json'), report);
  console.log(JSON.stringify(report, null, 2));
}

function showProfile(context) {
  const { profile, repoRoot } = context;
  console.log(
    JSON.stringify(
      {
        status: 'valid-profile',
        repoRoot,
        profilePath: profile.profilePath,
        projectName: profile.projectName,
        port: profile.port,
        launch: {
          command: profile.launch.command,
          args: profile.launch.args,
          cwd: profile.launch.cwdPath,
          readyTimeoutMs: profile.launch.readyTimeoutMs,
        },
        target: profile.target,
        evidenceRoot: profile.evidenceRoot,
      },
      null,
      2,
    ),
  );
}

function usage(repoRoot = DEFAULT_REPO_ROOT) {
  const script = path.relative(repoRoot, SCRIPT_FILE);
  console.log(`Usage:
  node ${script} profile [--root <repo>] [--profile <relative-path>]
  node ${script} launch --run-id <id> [--root <repo>] [--profile <relative-path>]
  node ${script} doctor --run-id <id> [--root <repo>] [--profile <relative-path>]
  node ${script} evidence-path --run-id <id> --name <file>
  node ${script} assert-png --run-id <id> --name <file.png>
  node ${script} record --run-id <id> --name <file.json> (--data <json> | --stdin)
  node ${script} cleanup --run-id <id>
  node ${script} probe --port <port>`);
}

async function main() {
  const { command, options } = parseCli(process.argv.slice(2));
  if (!command || command === 'help' || options.help) {
    usage(resolveRepoRoot(options));
    return;
  }
  if (command === 'probe') {
    await probe(requireString(options, 'port'));
    return;
  }

  const context = loadContext(options);
  if (command === 'profile') {
    showProfile(context);
    return;
  }
  const runId = requireString(options, 'run-id');

  switch (command) {
    case 'launch':
      await launch(context, runId);
      break;
    case 'doctor':
      await doctor(context, runId);
      break;
    case 'evidence-path':
      evidencePath(context, runId, requireString(options, 'name'));
      break;
    case 'assert-png':
      assertPng(context, runId, requireString(options, 'name'));
      break;
    case 'record':
      if (options.stdin && typeof options.data === 'string') {
        throw new Error('Use either --data or --stdin, not both.');
      }
      record(
        context,
        runId,
        requireString(options, 'name'),
        options.stdin ? readFileSync(0, 'utf8') : requireString(options, 'data'),
      );
      break;
    case 'cleanup':
      await cleanup(context, runId);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(`verify-debug-electron-mcp: ${error.message}`);
  process.exitCode = 1;
});
