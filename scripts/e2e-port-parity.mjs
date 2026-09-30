import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoApp = path.join(repoRoot, 'examples', 'demo-app');
const port = 9222;
const mcpBase = `http://127.0.0.1:${process.env.MCP_PORT ?? '3987'}/mcp`;
const debugBase = `http://127.0.0.1:${port}`;
const call = (method, params) =>
  fetch(mcpBase, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
      // The 2026 envelope requires the tool name as a header, not only in the body.
      ...(params?.name ? { 'mcp-name': params.name } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

/** Call one tool and return its structured payload, surfacing errors loudly. */
async function tool(name, args) {
  const response = await call('tools/call', { name, arguments: args, _meta: meta });
  const body = await response.json();
  if (!body.result) {
    throw new Error(`${name} returned no result: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.result;
}

const meta = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': { name: 'e2e', version: '1.0.0' },
};

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
}

const child = spawn(
  process.execPath,
  [path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe'), '.', `--remote-debugging-port=${port}`],
  { cwd: demoApp, stdio: 'ignore', env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' } },
);

try {
  let up = false;
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${debugBase}/json`);
      if (response.ok) { up = true; break; }
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) throw new Error('Electron debug port never opened');

  // 1. find_electron_apps recovers the port from the process list.
  const found = await tool('find_electron_apps', {});
  const processes = found.structuredContent.data.processes;
  check('find_electron_apps lists the running app', processes.length > 0,
    `found ${processes.length}`);
  check('find_electron_apps recovers the debug port',
    processes.some((p) => p.debugPort === port));

  // 2. register + inspect.
  const reg = await tool('register_project', { projectName: 'e2e', port });
  check('register_project connects', reg.structuredContent.data.connected === true);

  const windows = await tool('list_electron_windows', { projectName: 'e2e' });
  check('list_electron_windows finds a window',
    windows.structuredContent.data.windows.length > 0);

  // 3. NEW: page_info
  const info = await tool('send_command_to_electron', { projectName: 'e2e', command: 'page_info', args: {} });
  check('page_info returns a result', !info.isError,
    String(info.content?.[0]?.text ?? '').slice(0, 80));

  // 4. NEW: query_selector
  const query = await tool('send_command_to_electron', { projectName: 'e2e', command: 'query_selector', arguments: {}, args: { selector: 'button', limit: 3 } });
  check('query_selector runs', !query.isError,
    String(query.content?.[0]?.text ?? '').slice(0, 80));

  // 5. NEW: get_dom
  const dom = await tool('send_command_to_electron', { projectName: 'e2e', command: 'get_dom', args: { selector: 'body' } });
  check('get_dom returns markup', !dom.isError);

  // 6. NEW: rich wait
  const waited = await tool('send_command_to_electron', { projectName: 'e2e', command: 'wait', args: { selector: 'body', hidden: '.never-there', timeout: 3000 } });
  check('multi-condition wait matches', !waited.isError && !String(waited.content?.[0]?.text).includes('Timeout'),
    String(waited.content?.[0]?.text ?? '').slice(0, 90));

  // 7. NEW: cookies
  const cookie = await tool('perform_electron_actions', {
      projectName: 'e2e',
      actions: [{ kind: 'set_cookie', name: 'e2e', value: 'yes', url: 'http://127.0.0.1:9222/' }],
    });
  check('set_cookie succeeds', !cookie.isError,
    JSON.stringify(cookie.structuredContent?.data?.results ?? cookie.content).slice(0, 120));

  // 8. NEW: storage
  const storage = await tool('perform_electron_actions', {
      projectName: 'e2e',
      actions: [{ kind: 'set_storage', entries: { e2eKey: 'e2eValue' } }],
    });
  const storageResults = storage.structuredContent?.data?.results;
  check('set_storage succeeds', !storage.isError && storageResults?.[0]?.ok === true,
    JSON.stringify(storageResults ?? storage.content).slice(0, 120));

  // 9. NEW: tracing across a batch
  const tracePath = path.join(repoRoot, '.verification', 'e2e-trace.json');
  const traced = await tool('perform_electron_actions', {
      projectName: 'e2e',
      trace: { outputPath: tracePath },
      actions: [{ kind: 'snapshot', maxElements: 5 }, { kind: 'hover', target: { kind: 'coordinates', x: 100, y: 100 } }],
    });
  const traceData = traced.structuredContent?.data?.trace;
  check('trace recorded and written', Boolean(traceData?.filePath) && !traceData?.error,
    JSON.stringify(traceData).slice(0, 140));

  // 10. NEW: security guard
  const blocked = await tool('take_screenshot', { projectName: 'e2e', delivery: 'file', outputPath: `${process.env.USERPROFILE}\\.ssh\\pwned.png` });
  check('screenshot refuses a sensitive path',
    blocked.isError === true && String(blocked.content?.[0]?.text ?? '').includes('sensitive location'),
    String(blocked.content?.[0]?.text ?? '').slice(0, 90));

  // 11. NEW: selector-clipped screenshot
  const clipPath = path.join(repoRoot, '.verification', 'e2e-clip.png');
  const clipped = await tool('take_screenshot', { projectName: 'e2e', delivery: 'file', outputPath: clipPath, selector: 'body' });
  check('selector-clipped screenshot written', clipped.structuredContent?.data?.kind === 'file',
    String(clipped.content?.[0]?.text ?? '').slice(0, 90));

  // 12. NEW: raw CDP escape hatch
  const cdp = await tool('send_cdp_command', { projectName: 'e2e', method: 'Runtime.evaluate', params: { expression: '1+1', returnByValue: true } });
  check('send_cdp_command round-trips', !cdp.isError,
    JSON.stringify(cdp.structuredContent?.data ?? cdp.content).slice(0, 100));

  // 13. NEW: reload + pause/resume
  const control = await tool('perform_electron_actions', { projectName: 'e2e', actions: [{ kind: 'reload' }, { kind: 'pause' }, { kind: 'resume' }] });
  const controlResults = control.structuredContent?.data?.results;
  check('reload/pause/resume succeed', controlResults?.every((r) => r.ok) === true,
    JSON.stringify(controlResults ?? control.content).slice(0, 140));

  // 14. NEW: read_network — starts recording, then observes a real request.
  const netStart = await tool('read_network', { projectName: 'e2e', record: true });
  check('read_network starts recording', netStart.structuredContent?.data?.recording === true,
    String(netStart.content?.[0]?.text ?? '').slice(0, 90));

  // Make the renderer issue a request the recorder can observe.
  await tool('send_command_to_electron', {
    projectName: 'e2e',
    command: 'eval',
    args: { code: `fetch('https://example.com/probe').catch(() => null)` },
  });
  await new Promise((r) => setTimeout(r, 1500));
  const net = await tool('read_network', { projectName: 'e2e', limit: 20 });
  const netEntries = net.structuredContent?.data?.entries ?? [];
  check('read_network captured a request', netEntries.length > 0,
    `${netEntries.length} entries: ${netEntries.slice(0, 2).map((e) => e.url).join(', ')}`);

  const netFail = await tool('read_network', { projectName: 'e2e', failuresOnly: true, limit: 5 });
  check('read_network failure filter runs', netFail.structuredContent?.data?.recording === true);

  // 15. NEW: read_console — start recording, log from the page, then read.
  const conStart = await tool('read_console', { projectName: 'e2e', record: true });
  check('read_console starts recording', conStart.structuredContent?.data?.recording === true);

  await tool('send_command_to_electron', {
    projectName: 'e2e',
    command: 'console_log',
    args: { message: 'e2e-marker-line' },
  });
  await new Promise((r) => setTimeout(r, 800));
  const con = await tool('read_console', { projectName: 'e2e', limit: 50 });
  const conEntries = con.structuredContent?.data?.entries ?? [];
  check('read_console captured the logged marker',
    conEntries.some((e) => e.text.includes('e2e-marker-line')),
    `${conEntries.length} entries`);

  // 16. NEW: CPU profile alongside a batch.
  const profilePath = path.join(repoRoot, '.verification', 'e2e-profile.cpuprofile');
  const prof = await tool('perform_electron_actions', {
    projectName: 'e2e',
    profile: { outputPath: profilePath },
    actions: [{ kind: 'snapshot', maxElements: 5 }, { kind: 'press_key', key: 'Escape' }],
  });
  const profData = prof.structuredContent?.data?.profile;
  check('CPU profile written', Boolean(profData?.filePath) && !profData?.error,
    JSON.stringify(profData).slice(0, 130));

  // 17. NEW: prompts are discoverable.
  const prompts = await (await call('prompts/list', { _meta: meta })).json();
  const promptNames = (prompts.result?.prompts ?? []).map((p) => p.name).sort();
  check('prompts are registered',
    ['debug_blank_window', 'find_renderer_exception', 'ui_smoke_check'].every((n) => promptNames.includes(n)),
    promptNames.join(', '));
} finally {
  child.kill();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
