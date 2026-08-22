import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  describeElectronCommand,
  ElectronCommandSchema,
  parseElectronCommand,
} from '../application/commands';
import type { ElectronAutomation } from '../application/electron-automation';
import type { ProjectRegistry } from '../application/project-registry';

const serverVersion =
  typeof __PACKAGE_VERSION__ === 'string'
    ? __PACKAGE_VERSION__
    : (process.env.npm_package_version ?? '0.0.0-dev');
const serverInfo = { name: '@debugelectron/debug-electron-mcp', version: serverVersion };
const toolResultSchema = z.object({ ok: z.boolean(), data: z.unknown() });
const projectScopeSchema = z.object({ projectName: z.string().min(1).optional() });
const targetScopeSchema = projectScopeSchema.extend({
  targetId: z.string().min(1).optional(),
  windowTitle: z.string().min(1).optional(),
});

export const toolNames = Object.freeze([
  'describe_electron_command',
  'get_electron_window_info',
  'list_electron_windows',
  'list_projects',
  'read_electron_logs',
  'register_project',
  'send_command_to_electron',
  'take_screenshot',
  'unregister_project',
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
      inputSchema: z.object({ command: z.string().min(1) }),
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
      inputSchema: projectScopeSchema.extend({ includeChildren: z.boolean().optional() }),
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
      inputSchema: projectScopeSchema.extend({ includeDevTools: z.boolean().optional() }),
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
      inputSchema: z.object({}),
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
      inputSchema: projectScopeSchema.extend({
        logType: z.enum(['console', 'main', 'renderer', 'all']).optional(),
        lines: z.number().int().min(1).max(500).optional(),
      }),
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
      inputSchema: z.object({
        projectName: z.string().min(1),
        port: z.number().int().min(1).max(65_535).optional(),
        windowTitlePattern: z.string().min(1).optional(),
      }),
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
      inputSchema: targetScopeSchema.extend({
        command: ElectronCommandSchema,
        args: z.record(z.string(), z.unknown()).default({}),
      }),
      outputSchema: toolResultSchema,
    },
    async ({ command, args, targetId, windowTitle, ...scope }) => {
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
    'take_screenshot',
    {
      description: 'Capture an Electron window. Inline bytes are opt-in when saving a file.',
      inputSchema: targetScopeSchema.extend({
        outputPath: z.string().min(1).optional(),
        delivery: z.enum(['inline', 'file']).optional(),
      }),
      outputSchema: toolResultSchema,
    },
    async ({ outputPath, delivery, targetId, windowTitle, ...scope }) => {
      try {
        const screenshot = await automation.takeScreenshot({
          outputPath,
          delivery,
          targetId,
          windowTitle,
          ports: resolvePorts(scope, projects),
        });
        if (screenshot.kind === 'inline') {
          return {
            content: [
              { type: 'text' as const, text: `Inline screenshot, ${screenshot.bytes} bytes.` },
              { type: 'image' as const, data: screenshot.base64, mimeType: 'image/png' as const },
            ],
            structuredContent: {
              ok: true,
              data: { kind: 'inline' as const, bytes: screenshot.bytes },
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
      inputSchema: z.object({ projectName: z.string().min(1) }),
      outputSchema: toolResultSchema,
    },
    ({ projectName }) => {
      const removed = projects.unregister(projectName);
      return removed
        ? success({ projectName, removed }, `Project ${projectName} removed.`)
        : failure(new Error(`Project "${projectName}" was not found.`));
    },
  );

  return server;
}
