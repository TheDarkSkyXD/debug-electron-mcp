import { CallToolRequest } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';
import { ToolName } from './tools';
import {
  SendCommandToElectronSchema,
  TakeScreenshotSchema,
  ReadElectronLogsSchema,
  GetElectronWindowInfoSchema,
  ListElectronWindowsSchema,
  RegisterProjectSchema,
  UnregisterProjectSchema,
  ListProjectsSchema,
} from './schemas';
import { sendCommandToElectron } from './utils/electron-enhanced-commands';
import { getElectronWindowInfo, listElectronWindows, scanForElectronApps } from './utils/electron-discovery';
import { WindowTargetOptions } from './utils/electron-connection';
import { readElectronLogs } from './utils/electron-logs';
import { takeScreenshot } from './screenshot';
import { projectRegistry } from './project-registry';
import { logger } from './utils/logger';

/** Default project name set via --project CLI flag */
let defaultProjectName: string | undefined;

export function setDefaultProject(name: string | undefined) {
  defaultProjectName = name;
}

/**
 * Resolve projectName to a list of ports.
 * Returns undefined if no project scoping is needed (scan all ports).
 */
function resolveProjectPorts(projectName?: string): number[] | undefined {
  const effectiveName = projectName || defaultProjectName;
  if (!effectiveName) return undefined;

  const config = projectRegistry.resolve(effectiveName);
  if (!config) {
    throw new Error(
      `Project "${effectiveName}" is not registered. Use register_project first, or run list_projects to see registered projects.`,
    );
  }
  return [config.port];
}

export async function handleToolCall(request: CallToolRequest) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case ToolName.GET_ELECTRON_WINDOW_INFO: {
        const { includeChildren, projectName } = GetElectronWindowInfoSchema.parse(args);
        const ports = resolveProjectPorts(projectName);
        const result = await getElectronWindowInfo(includeChildren, ports);
        return {
          content: [
            {
              type: 'text',
              text: `Window Information:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
          isError: false,
        };
      }

      case ToolName.TAKE_SCREENSHOT: {
        const { outputPath, targetId, windowTitle, projectName } = TakeScreenshotSchema.parse(args);
        const ports = resolveProjectPorts(projectName);
        const result = await takeScreenshot({ outputPath, targetId, windowTitle, ports });

        const content: any[] = [];

        if (result.filePath) {
          content.push({
            type: 'text',
            text: `Screenshot saved to: ${result.filePath}`,
          });
        } else {
          content.push({
            type: 'text',
            text: 'Screenshot captured in memory (no file saved)',
          });
        }

        // Add the image data for AI evaluation
        content.push({
          type: 'image',
          data: result.base64!,
          mimeType: 'image/png',
        });

        return { content, isError: false };
      }

      case ToolName.SEND_COMMAND_TO_ELECTRON: {
        const {
          command,
          args: commandArgs,
          targetId,
          windowTitle,
          projectName,
        } = SendCommandToElectronSchema.parse(args);

        const ports = resolveProjectPorts(projectName);

        // Build window target options if specified
        const windowOptions: WindowTargetOptions | undefined =
          targetId || windowTitle || ports
            ? { targetId, windowTitle, ports }
            : undefined;

        const result = await sendCommandToElectron(command, commandArgs, windowOptions);
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }

      case ToolName.READ_ELECTRON_LOGS: {
        const { logType, lines, follow, projectName } = ReadElectronLogsSchema.parse(args);
        const ports = resolveProjectPorts(projectName);
        const logs = await readElectronLogs(logType, lines, follow, ports);

        if (follow) {
          return {
            content: [
              {
                type: 'text',
                text: `Following logs (${logType}). This is a snapshot of recent logs:\n\n${logs}`,
              },
            ],
            isError: false,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Electron logs (${logType}):\n\n${logs}`,
            },
          ],
          isError: false,
        };
      }

      case ToolName.LIST_ELECTRON_WINDOWS: {
        const { includeDevTools, projectName } = ListElectronWindowsSchema.parse(args);
        const ports = resolveProjectPorts(projectName);
        const windows = await listElectronWindows(includeDevTools, ports);

        if (windows.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No Electron windows found. Ensure your app is running with --remote-debugging-port=9222',
              },
            ],
            isError: false,
          };
        }

        const formatted = windows
          .map(
            (w) => `- [${w.id}] "${w.title}" (port: ${w.port}, type: ${w.type})\n  URL: ${w.url}`,
          )
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Available Electron windows (${windows.length}):\n\n${formatted}`,
            },
          ],
          isError: false,
        };
      }

      case ToolName.REGISTER_PROJECT: {
        const { projectName, port, windowTitlePattern } = RegisterProjectSchema.parse(args);
        const config = projectRegistry.register(projectName, port, windowTitlePattern);

        // Check if the port is currently reachable
        let statusNote = '';
        try {
          const apps = await scanForElectronApps([config.port]);
          if (apps.length > 0) {
            statusNote = `\n\nNote: An Electron app is already running on port ${config.port} with ${apps[0].targets.length} window(s).`;
          }
        } catch {
          // ignore
        }

        return {
          content: [
            {
              type: 'text',
              text: `Project "${projectName}" registered on port ${config.port}.${
                config.windowTitlePattern
                  ? ` Window title filter: "${config.windowTitlePattern}".`
                  : ''
              }\n\nStart your Electron app with:\n  electron . --remote-debugging-port=${config.port}${statusNote}`,
            },
          ],
          isError: false,
        };
      }

      case ToolName.UNREGISTER_PROJECT: {
        const { projectName } = UnregisterProjectSchema.parse(args);
        const removed = projectRegistry.unregister(projectName);

        if (!removed) {
          return {
            content: [
              {
                type: 'text',
                text: `Project "${projectName}" was not found in the registry.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Project "${projectName}" has been unregistered and its port freed.`,
            },
          ],
          isError: false,
        };
      }

      case ToolName.LIST_PROJECTS: {
        ListProjectsSchema.parse(args);
        const projects = projectRegistry.list();
        const entries = Object.entries(projects);

        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No projects registered. Use register_project to register a project.',
              },
            ],
            isError: false,
          };
        }

        // Check connection status for each project
        const lines: string[] = [];
        for (const [name, config] of entries) {
          let status = 'not connected';
          try {
            const apps = await scanForElectronApps([config.port]);
            if (apps.length > 0) {
              status = `connected (${apps[0].targets.length} window(s))`;
            }
          } catch {
            // ignore
          }

          lines.push(
            `- ${name}: port ${config.port} [${status}]${
              config.windowTitlePattern ? ` (filter: "${config.windowTitlePattern}")` : ''
            }`,
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: `Registered projects (${entries.length}):\n\n${lines.join('\n')}`,
            },
          ],
          isError: false,
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(`Tool execution failed: ${name}`, {
      error: errorMessage,
      stack: errorStack,
      args,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
