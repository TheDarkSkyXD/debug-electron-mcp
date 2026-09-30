import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  describeElectronCommand,
  ElectronCommandSchema,
  parseElectronCommand,
} from '../application/commands';
import {
  ElectronActionBatchSchema,
  ProfileCaptureSchema,
  TraceCaptureSchema,
} from '../application/electron-actions';
import type { ElectronAutomation } from '../application/electron-automation';
import type { ProjectRegistry } from '../application/project-registry';

const serverVersion =
  typeof __PACKAGE_VERSION__ === 'string'
    ? __PACKAGE_VERSION__
    : (process.env.npm_package_version ?? '0.0.0-dev');
const serverInfo = { name: '@debugelectron/debug-electron-mcp', version: serverVersion };
function compileSchema<Schema extends z.ZodType>(schema: Schema): Pick<Schema, '~standard'> {
  const jsonSchema = z.toJSONSchema(schema);
  return {
    '~standard': {
      ...schema['~standard'],
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
    },
  };
}

const toolResultSchema = compileSchema(z.object({ ok: z.boolean(), data: z.unknown() }));
const projectScopeSchema = z.object({ projectName: z.string().min(1).optional() });
const targetScopeSchema = projectScopeSchema.extend({
  targetId: z.string().min(1).optional(),
  windowTitle: z.string().min(1).optional(),
});
const describeCommandInputSchema = compileSchema(z.object({ command: z.string().min(1) }));
const windowInfoInputSchema = compileSchema(
  projectScopeSchema.extend({ includeChildren: z.boolean().optional() }),
);
const listWindowsInputSchema = compileSchema(
  projectScopeSchema.extend({ includeDevTools: z.boolean().optional() }),
);
const emptyInputSchema = compileSchema(z.object({}));
const readLogsInputSchema = compileSchema(
  projectScopeSchema.extend({
    logType: z.enum(['console', 'main', 'renderer', 'all']).optional(),
    lines: z.number().int().min(1).max(500).optional(),
  }),
);
const registerProjectInputSchema = compileSchema(
  z.object({
    projectName: z.string().min(1),
    port: z.number().int().min(1).max(65_535).optional(),
    windowTitlePattern: z.string().min(1).optional(),
  }),
);
const sendCommandInputSchema = compileSchema(
  targetScopeSchema.extend({
    command: ElectronCommandSchema,
    args: z.record(z.string(), z.unknown()).optional(),
  }),
);
const performActionsInputSchema = compileSchema(
  targetScopeSchema.extend({
    actions: ElectronActionBatchSchema,
    stopOnError: z.boolean().optional(),
    trace: TraceCaptureSchema.optional(),
    profile: ProfileCaptureSchema.optional(),
  }),
);
const screenshotInputSchema = compileSchema(
  targetScopeSchema.extend({
    outputPath: z.string().min(1).optional(),
    delivery: z.enum(['inline', 'file']).optional(),
    format: z.enum(['png', 'jpeg']).optional(),
    quality: z.number().int().min(0).max(100).optional(),
    selector: z.string().min(1).optional(),
  }),
);
const unregisterProjectInputSchema = compileSchema(z.object({ projectName: z.string().min(1) }));
const startAppInputSchema = compileSchema(
  z.object({
    projectName: z.string().min(1),
    appPath: z.string().min(1),
    extraArgs: z.array(z.string()).optional(),
    inspectMain: z.boolean().optional(),
  }),
);
const stopAppInputSchema = compileSchema(z.object({ pid: z.number().int().positive() }));
const findAppsInputSchema = compileSchema(z.object({}));
const cdpCommandInputSchema = compileSchema(
  targetScopeSchema.extend({
    method: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
);
const readNetworkInputSchema = compileSchema(
  targetScopeSchema.extend({
    limit: z.number().int().min(1).max(500).optional(),
    failuresOnly: z.boolean().optional(),
    record: z.boolean().optional(),
  }),
);
const readConsoleInputSchema = compileSchema(
  targetScopeSchema.extend({
    limit: z.number().int().min(1).max(500).optional(),
    level: z.string().min(1).optional(),
    errorsOnly: z.boolean().optional(),
    record: z.boolean().optional(),
  }),
);

export const toolNames = Object.freeze([
  'describe_electron_command',
  'find_electron_apps',
  'get_electron_window_info',
  'list_electron_windows',
  'list_projects',
  'perform_electron_actions',
  'read_electron_logs',
  'read_console',
  'read_network',
  'register_project',
  'send_cdp_command',
  'send_command_to_electron',
  'start_electron_app',
  'stop_electron_app',
  'take_screenshot',
  'unregister_project',
] as const);

export const promptNames = Object.freeze([
  'debug_blank_window',
  'find_renderer_exception',
  'ui_smoke_check',
] as const);

export type ProjectScope = z.infer<typeof projectScopeSchema>;

export interface McpServerDependencies {
  readonly automation: ElectronAutomation;
  readonly projects: ProjectRegistry;
}

function success(data: unknown, text: string) {
  return { content: [{ type: 'text' as const, text }], structuredContent: { ok: true, data } };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    structuredContent: { ok: false, data: { error: message } },
    isError: true,
  };
}

function resolvePorts(
  scope: ProjectScope,
  projects: ProjectRegistry,
): readonly number[] | undefined {
  if (!scope.projectName) return undefined;
  const project = projects.resolve(scope.projectName);
  if (!project) throw new Error(`Project "${scope.projectName}" is not registered.`);
  return [project.port];
}

function projectRows(projects: ProjectRegistry) {
  return Object.entries(projects.list())
    .map(([name, config]) => ({
      name,
      port: config.port,
      windowTitlePattern: config.windowTitlePattern,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createMcpServer({ automation, projects }: McpServerDependencies): McpServer {
  const server = new McpServer(serverInfo, {
    capabilities: { tools: {} },
    cacheHints: {
      'server/discover': { ttlMs: 86_400_000, cacheScope: 'public' },
      'tools/list': { ttlMs: 86_400_000, cacheScope: 'public' },
    },
  });

  server.registerTool(
    'describe_electron_command',
    {
      description: 'Return exact arguments for one Electron command.',
      inputSchema: describeCommandInputSchema,
      outputSchema: toolResultSchema,
    },
    ({ command }) => {
      try {
        const parsedCommand = ElectronCommandSchema.parse(command);
        return success(describeElectronCommand(parsedCommand), `Command ${parsedCommand}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'get_electron_window_info',
    {
      description: 'Inspect one running Electron application.',
      inputSchema: windowInfoInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({ includeChildren = false, ...scope }) => {
      try {
        const info = await automation.getWindowInfo({
          includeChildren,
          ports: resolvePorts(scope, projects),
        });
        return success(
          info,
          info.automationReady ? `${info.windows.length} window(s).` : info.message,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'list_electron_windows',
    {
      description: 'List Electron windows with stable ordering.',
      inputSchema: listWindowsInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({ includeDevTools = false, ...scope }) => {
      try {
        const windows = await automation.listWindows({
          includeDevTools,
          ports: resolvePorts(scope, projects),
        });
        return success({ windows }, `${windows.length} window(s).`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'list_projects',
    {
      description: 'List registered Electron projects.',
      inputSchema: emptyInputSchema,
      outputSchema: toolResultSchema,
    },
    () => {
      const rows = projectRows(projects);
      return success({ projects: rows }, `${rows.length} project(s).`);
    },
  );

  server.registerTool(
    'read_electron_logs',
    {
      description: 'Read a bounded Electron log snapshot.',
      inputSchema: readLogsInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({ logType = 'all', lines = 100, ...scope }) => {
      try {
        const logs = await automation.readLogs({
          logType,
          lines,
          ports: resolvePorts(scope, projects),
        });
        return success({ logs }, `Log snapshot with up to ${lines} lines.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'register_project',
    {
      description: 'Register an Electron DevTools port.',
      inputSchema: registerProjectInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({ projectName, port, windowTitlePattern }) => {
      try {
        const project = projects.register(projectName, port, windowTitlePattern);
        const apps = await automation.discover([project.port]);
        return success(
          { name: projectName, ...project, connected: apps.length > 0 },
          `Project ${projectName} on port ${project.port}.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'send_command_to_electron',
    {
      description: 'Run one named command in an Electron renderer.',
      inputSchema: sendCommandInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({ command, args = {}, targetId, windowTitle, ...scope }) => {
      try {
        const result = await automation.executeCommand({
          request: parseElectronCommand(command, args),
          target: {
            targetId,
            windowTitle,
            ports: resolvePorts(scope, projects),
          },
        });
        return success({ command, result }, `Command ${command} completed.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'perform_electron_actions',
    {
      description:
        'Run ordered native input, navigation, snapshot, or legacy renderer actions in one Electron window.',
      inputSchema: performActionsInputSchema,
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ actions, stopOnError = true, trace, profile, targetId, windowTitle, ...scope }) => {
      try {
        const output = await automation.performActions({
          actions,
          stopOnError,
          trace,
          profile,
          target: {
            targetId,
            windowTitle,
            ports: resolvePorts(scope, projects),
          },
        });
        const failures = output.results.filter((result) => !result.ok).length;
        const notes = [
          `${output.results.length - failures} action(s) succeeded, ${failures} failed.`,
        ];
        if (output.trace && !output.trace.error) {
          notes.push(
            `Trace: ${output.trace.eventCount} event(s) in ${output.trace.elapsedMs}ms -> ${output.trace.filePath}.`,
          );
        }
        if (output.profile && !output.profile.error) {
          notes.push(`Profile -> ${output.profile.filePath}.`);
        }
        for (const capture of [output.trace, output.profile]) {
          if (capture?.error) notes.push(`Capture could not be written: ${capture.error}`);
        }
        return success(output, notes.join(' '));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'send_cdp_command',
    {
      description:
        'Run one arbitrary Chrome DevTools Protocol method, in Domain.method form, against an Electron window.',
      inputSchema: cdpCommandInputSchema,
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ method, params, targetId, windowTitle, ...scope }) => {
      try {
        const result = await automation.sendCdpCommand({
          method,
          params,
          target: {
            targetId,
            windowTitle,
            ports: resolvePorts(scope, projects),
          },
        });
        return success({ method, result }, `CDP method ${method} completed.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'take_screenshot',
    {
      description: 'Capture an Electron window. Inline bytes are opt-in when saving a file.',
      inputSchema: screenshotInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({
      outputPath,
      delivery,
      format,
      quality,
      selector,
      targetId,
      windowTitle,
      ...scope
    }) => {
      try {
        const screenshot = await automation.takeScreenshot({
          outputPath,
          delivery,
          format,
          quality,
          selector,
          targetId,
          windowTitle,
          ports: resolvePorts(scope, projects),
        });
        if (screenshot.kind === 'inline') {
          return {
            content: [
              { type: 'text' as const, text: `Inline screenshot, ${screenshot.bytes} bytes.` },
              { type: 'image' as const, data: screenshot.base64, mimeType: screenshot.mimeType },
            ],
            structuredContent: {
              ok: true,
              data: {
                kind: 'inline' as const,
                bytes: screenshot.bytes,
                mimeType: screenshot.mimeType,
              },
            },
          };
        }
        return success(screenshot, `Screenshot saved to ${screenshot.filePath}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'unregister_project',
    {
      description: 'Remove a registered Electron project.',
      inputSchema: unregisterProjectInputSchema,
      outputSchema: toolResultSchema,
    },
    ({ projectName }) => {
      const removed = projects.unregister(projectName);
      return removed
        ? success({ projectName, removed }, `Project ${projectName} removed.`)
        : failure(new Error(`Project "${projectName}" was not found.`));
    },
  );

  server.registerTool(
    'find_electron_apps',
    {
      description:
        'List running Electron processes and the remote debugging port each was launched with.',
      inputSchema: findAppsInputSchema,
      outputSchema: toolResultSchema,
    },
    async () => {
      try {
        const processes = await automation.findProcesses();
        return success({ processes }, `${processes.length} Electron process(es).`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'start_electron_app',
    {
      description:
        'Launch an Electron app with remote debugging enabled and register it as a project. The app keeps running after the call returns.',
      inputSchema: startAppInputSchema,
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ projectName, appPath, extraArgs, inspectMain }) => {
      try {
        const project = projects.register(projectName);
        const started = await automation.startApp({
          appPath,
          debugPort: project.port,
          extraArgs,
          inspectMain,
        });
        const apps = await automation.discover([project.port]);
        return success(
          { projectName, ...project, ...started, connected: apps.length > 0 },
          `Started ${started.appPath} as ${projectName} on port ${project.port} (pid ${started.pid}).`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'read_console',
    {
      description:
        'Read renderer console, log, and exception output from a window. Pass record:true on the first call to start capturing.',
      inputSchema: readConsoleInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({
      limit,
      level,
      errorsOnly = false,
      record = false,
      targetId,
      windowTitle,
      ...scope
    }) => {
      try {
        const console_ = await automation.readConsole({
          limit,
          level,
          errorsOnly,
          record,
          target: {
            targetId,
            windowTitle,
            ports: resolvePorts(scope, projects),
          },
        });
        const count = console_.entries.length;
        const summary = console_.recording
          ? `${count} console entr${count === 1 ? 'y' : 'ies'}.`
          : 'Not recording.';
        return success(console_, console_.hint ? `${summary} ${console_.hint}` : summary);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'read_network',
    {
      description:
        'Read network requests observed on a window. Pass record:true on the first call to start capturing.',
      inputSchema: readNetworkInputSchema,
      outputSchema: toolResultSchema,
    },
    async ({ limit, failuresOnly = false, record = false, targetId, windowTitle, ...scope }) => {
      try {
        const network = await automation.readNetwork({
          limit,
          failuresOnly,
          record,
          target: {
            targetId,
            windowTitle,
            ports: resolvePorts(scope, projects),
          },
        });
        const summary = network.recording
          ? `${network.entries.length} network entr${network.entries.length === 1 ? 'y' : 'ies'}.`
          : 'Not recording.';
        return success(network, network.hint ? `${summary} ${network.hint}` : summary);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'stop_electron_app',
    {
      description: 'Stop a running Electron process, including its child processes.',
      inputSchema: stopAppInputSchema,
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ pid }) => {
      try {
        const stopped = await automation.stopApp(pid);
        return success(
          stopped,
          stopped.alreadyExited ? `Process ${pid} was already gone.` : `Stopped process ${pid}.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  registerDiagnosticPrompts(server);

  return server;
}

/**
 * Canned investigation workflows.
 *
 * A prompt is only a message, so these are stateless by construction: they
 * name tools the caller already has and cost nothing when unused. Each one
 * exists because the tool order reliably matters for that class of failure and
 * getting it wrong produces a misleading answer.
 */
function registerDiagnosticPrompts(server: McpServer): void {
  const scopeShape = { projectName: z.string().min(1).optional() };

  server.registerPrompt(
    'debug_blank_window',
    {
      title: 'Diagnose a blank window',
      description: 'Work through the causes of a blank or white Electron window.',
      argsSchema: z.object(scopeShape).strict(),
    },
    ({ projectName = 'the registered project' }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `The Electron window for ${projectName} is blank or white. Investigate in this order and stop as soon as you have the cause.

1. list_electron_windows, then get_electron_window_info, to confirm a window exists and is not a DevTools window.
2. take_screenshot to confirm what is actually on screen.
3. send_command_to_electron with page_info, to get the URL, title, and readyState. A file:// URL, about:blank, or a readyState still loading is itself the finding.
4. read_electron_logs for main-process and renderer errors.
5. send_command_to_electron with get_dom, selector body, to see whether the document has any children.
6. read_network with failuresOnly true, to catch a failed asset or API call that left the tree empty.

Report the most likely cause and the single next fix. If step 3 shows the page never finished loading, say so rather than continuing to steps 4 to 6.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'find_renderer_exception',
    {
      title: 'Find a renderer exception',
      description: 'Locate a renderer-side exception and its stack.',
      argsSchema: z.object(scopeShape).strict(),
    },
    ({ projectName = 'the registered project' }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Find the renderer exception in ${projectName}.

1. read_electron_logs with logType renderer, lines 200.
2. If that is empty, the exception may have fired before the window was inspected. Reproduce the failure, then read again.
3. send_command_to_electron with eval, expression window.__lastError ?? 'none', to check for a stashed error.
4. read_network with failuresOnly true, record true, to catch a rejected request that the app did not catch.
5. If you need the main process instead, start the app with inspectMain and evaluate there.

Report the error text, the stack, the target, and the likely fix. If you cannot reproduce it, say what you tried rather than guessing at a cause.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'ui_smoke_check',
    {
      title: 'Smoke check a UI flow',
      description: 'Drive one interaction and verify the result.',
      argsSchema: z
        .object({
          ...scopeShape,
          selector: z.string().min(1),
          interaction: z.enum(['click', 'type']).default('click'),
        })
        .strict(),
    },
    ({ projectName = 'the registered project', selector, interaction }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Smoke check ${selector} in ${projectName} with a ${interaction}.

1. perform_electron_actions with snapshot, to confirm the element exists and is visible.
2. perform_electron_actions with a ${interaction} action targeting ${JSON.stringify(selector)}.
3. perform_electron_actions with wait, on a selector or text that should change as a result.
4. take_screenshot after the interaction.
5. read_electron_logs for console errors.

If the element is absent from the snapshot, report that rather than retrying. If the wait times out, the wait result names which conditions were satisfied, so use that to tell a no-op click from a wrong expectation.`,
          },
        },
      ],
    }),
  );
}
