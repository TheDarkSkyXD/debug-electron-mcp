import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';
import { ToolName } from './tools';
import {
  SendCommandToElectronSchema,
  TakeScreenshotSchema,
  ReadElectronLogsSchema,
  GetElectronWindowInfoSchema,
  ListElectronWindowsSchema,
} from './schemas';
import { sendCommandToElectron } from './utils/electron-enhanced-commands';
import { getElectronWindowInfo, listElectronWindows } from './utils/electron-discovery';
import { WindowTargetOptions } from './utils/electron-connection';
import { readElectronLogs } from './utils/electron-logs';
import { takeScreenshot } from './screenshot';
import { logger } from './utils/logger';

export async function handleToolCall(request: z.infer<typeof CallToolRequestSchema>) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case ToolName.GET_ELECTRON_WINDOW_INFO: {
        const { includeChildren } = GetElectronWindowInfoSchema.parse(args);
        const result = await getElectronWindowInfo(includeChildren);
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
        const { outputPath, windowTitle } = TakeScreenshotSchema.parse(args);
        const result = await takeScreenshot(outputPath, windowTitle);

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
        } = SendCommandToElectronSchema.parse(args);

        // Build window target options if specified
        const windowOptions: WindowTargetOptions | undefined =
          targetId || windowTitle ? { targetId, windowTitle } : undefined;

        const result = await sendCommandToElectron(command, commandArgs, windowOptions);
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }

      case ToolName.READ_ELECTRON_LOGS: {
        const { logType, lines, follow } = ReadElectronLogsSchema.parse(args);
        const logs = await readElectronLogs(logType, lines);

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
        const { includeDevTools } = ListElectronWindowsSchema.parse(args);
        const windows = await listElectronWindows(includeDevTools);

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
