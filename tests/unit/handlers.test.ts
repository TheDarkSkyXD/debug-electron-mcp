import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../../src/utils/electron-enhanced-commands', () => ({
    sendCommandToElectron: vi.fn(),
}));

vi.mock('../../src/utils/electron-discovery', () => ({
    getElectronWindowInfo: vi.fn(),
    listElectronWindows: vi.fn(),
}));

vi.mock('../../src/utils/electron-logs', () => ({
    readElectronLogs: vi.fn(),
}));

vi.mock('../../src/screenshot', () => ({
    takeScreenshot: vi.fn(),
}));

import { handleToolCall } from '../../src/handlers';
import { sendCommandToElectron } from '../../src/utils/electron-enhanced-commands';
import { getElectronWindowInfo, listElectronWindows } from '../../src/utils/electron-discovery';
import { readElectronLogs } from '../../src/utils/electron-logs';
import { takeScreenshot } from '../../src/screenshot';
import { ToolName } from '../../src/tools';

const mockedSendCommand = vi.mocked(sendCommandToElectron);
const mockedGetWindowInfo = vi.mocked(getElectronWindowInfo);
const mockedListWindows = vi.mocked(listElectronWindows);
const mockedReadLogs = vi.mocked(readElectronLogs);
const mockedTakeScreenshot = vi.mocked(takeScreenshot);

describe('Tool Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('get_electron_window_info', () => {
        it('should return window info successfully', async () => {
            const mockWindowInfo = {
                platform: 'win32',
                windows: [],
                totalTargets: 0,
                electronTargets: 0,
                message: 'Found running Electron application',
                automationReady: true,
            };
            mockedGetWindowInfo.mockResolvedValue(mockWindowInfo);

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.GET_ELECTRON_WINDOW_INFO,
                    arguments: { includeChildren: true },
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('Window Information');
            expect(mockedGetWindowInfo).toHaveBeenCalledWith(true);
        });
    });

    describe('take_screenshot', () => {
        it('should capture screenshot and return base64 data', async () => {
            mockedTakeScreenshot.mockResolvedValue({
                base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
                data: 'Screenshot captured successfully',
            });

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.TAKE_SCREENSHOT,
                    arguments: {},
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content).toHaveLength(2);
            expect(result.content[0].text).toContain('Screenshot captured');
            expect(result.content[1].type).toBe('image');
            expect(result.content[1].mimeType).toBe('image/png');
        });

        it('should include file path when outputPath is provided', async () => {
            mockedTakeScreenshot.mockResolvedValue({
                filePath: '/tmp/screenshot.png',
                base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
                data: 'Screenshot saved',
            });

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.TAKE_SCREENSHOT,
                    arguments: { outputPath: '/tmp/screenshot.png' },
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('/tmp/screenshot.png');
        });
    });

    describe('send_command_to_electron', () => {
        it('should execute command and return result', async () => {
            mockedSendCommand.mockResolvedValue('Command executed successfully');

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.SEND_COMMAND_TO_ELECTRON,
                    arguments: {
                        command: 'get_title',
                        args: {},
                    },
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toBe('Command executed successfully');
        });

        it('should pass window target options when provided', async () => {
            mockedSendCommand.mockResolvedValue('Clicked button');

            await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.SEND_COMMAND_TO_ELECTRON,
                    arguments: {
                        command: 'click_by_text',
                        args: { text: 'Submit' },
                        targetId: 'window-123',
                        windowTitle: 'Settings',
                    },
                },
            });

            expect(mockedSendCommand).toHaveBeenCalledWith(
                'click_by_text',
                { text: 'Submit' },
                { targetId: 'window-123', windowTitle: 'Settings' }
            );
        });
    });

    describe('read_electron_logs', () => {
        it('should return logs with specified type', async () => {
            mockedReadLogs.mockResolvedValue('[INFO] App started\n[DEBUG] Loading...');

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.READ_ELECTRON_LOGS,
                    arguments: { logType: 'all', lines: 50 },
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('Electron logs');
            expect(result.content[0].text).toContain('[INFO] App started');
        });

        it('should indicate follow mode when enabled', async () => {
            mockedReadLogs.mockResolvedValue('Live log output...');

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.READ_ELECTRON_LOGS,
                    arguments: { logType: 'console', lines: 20, follow: true },
                },
            });

            expect(result.content[0].text).toContain('Following logs');
        });
    });

    describe('list_electron_windows', () => {
        it('should return formatted list of windows', async () => {
            mockedListWindows.mockResolvedValue([
                { id: 'main', title: 'My App', url: 'file:///app.html', port: 9222, type: 'page' },
                { id: 'settings', title: 'Settings', url: 'file:///settings.html', port: 9222, type: 'page' },
            ]);

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.LIST_ELECTRON_WINDOWS,
                    arguments: { includeDevTools: false },
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('Available Electron windows (2)');
            expect(result.content[0].text).toContain('My App');
            expect(result.content[0].text).toContain('Settings');
        });

        it('should return helpful message when no windows found', async () => {
            mockedListWindows.mockResolvedValue([]);

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.LIST_ELECTRON_WINDOWS,
                    arguments: { includeDevTools: false },
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content[0].text).toContain('No Electron windows found');
            expect(result.content[0].text).toContain('--remote-debugging-port=9222');
        });
    });

    describe('error handling', () => {
        it('should handle unknown tool gracefully', async () => {
            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: 'unknown_tool' as any,
                    arguments: {},
                },
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Unknown tool');
        });

        it('should handle execution errors gracefully', async () => {
            mockedTakeScreenshot.mockRejectedValue(new Error('No Electron app running'));

            const result = await handleToolCall({
                method: 'tools/call',
                params: {
                    name: ToolName.TAKE_SCREENSHOT,
                    arguments: {},
                },
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Error executing');
            expect(result.content[0].text).toContain('No Electron app running');
        });
    });
});
