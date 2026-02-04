import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('playwright', () => ({
    chromium: {
        connectOverCDP: vi.fn(),
    },
}));

vi.mock('../../src/utils/electron-discovery', () => ({
    scanForElectronApps: vi.fn(),
}));

vi.mock('fs/promises', () => ({
    writeFile: vi.fn(),
}));

import { takeScreenshot } from '../../src/screenshot';
import { chromium } from 'playwright';
import { scanForElectronApps } from '../../src/utils/electron-discovery';
import * as fs from 'fs/promises';

const mockedChromium = vi.mocked(chromium);
const mockedScanApps = vi.mocked(scanForElectronApps);
const mockedWriteFile = vi.mocked(fs.writeFile);

describe('Screenshot Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('takeScreenshot', () => {
        it('should throw error when no Electron apps found', async () => {
            mockedScanApps.mockResolvedValue([]);

            await expect(takeScreenshot()).rejects.toThrow(
                'No running Electron applications found with remote debugging enabled'
            );
        });

        it('should connect to first app when no window title specified', async () => {
            const mockPage = {
                url: () => 'file:///app/index.html',
                title: () => Promise.resolve('My App'),
                screenshot: vi.fn().mockResolvedValue(Buffer.from('PNG_DATA')),
            };

            const mockContext = {
                pages: () => [mockPage],
            };

            const mockBrowser = {
                contexts: () => [mockContext],
                close: vi.fn(),
            };

            mockedScanApps.mockResolvedValue([
                {
                    port: 9222,
                    targets: [{ id: 'main', title: 'My App', url: 'file:///app/index.html', type: 'page' }],
                },
            ]);

            mockedChromium.connectOverCDP.mockResolvedValue(mockBrowser as any);

            const result = await takeScreenshot();

            expect(mockedChromium.connectOverCDP).toHaveBeenCalledWith('http://localhost:9222');
            expect(result.base64).toBe(Buffer.from('PNG_DATA').toString('base64'));
            expect(mockBrowser.close).toHaveBeenCalled();
        });

        it('should find app by window title when specified', async () => {
            const mockPage = {
                url: () => 'file:///app/settings.html',
                title: () => Promise.resolve('Settings'),
                screenshot: vi.fn().mockResolvedValue(Buffer.from('SETTINGS_PNG')),
            };

            const mockContext = {
                pages: () => [mockPage],
            };

            const mockBrowser = {
                contexts: () => [mockContext],
                close: vi.fn(),
            };

            mockedScanApps.mockResolvedValue([
                {
                    port: 9222,
                    targets: [{ id: 'main', title: 'My App', url: 'file:///app/index.html', type: 'page' }],
                },
                {
                    port: 9223,
                    targets: [{ id: 'settings', title: 'Settings', url: 'file:///app/settings.html', type: 'page' }],
                },
            ]);

            mockedChromium.connectOverCDP.mockResolvedValue(mockBrowser as any);

            const result = await takeScreenshot(undefined, 'Settings');

            expect(mockedChromium.connectOverCDP).toHaveBeenCalledWith('http://localhost:9223');
            expect(result.base64).toBeDefined();
        });

        it('should save screenshot to file when outputPath provided', async () => {
            const screenshotBuffer = Buffer.from('PNG_FILE_DATA');

            const mockPage = {
                url: () => 'file:///app/index.html',
                title: () => Promise.resolve('My App'),
                screenshot: vi.fn().mockResolvedValue(screenshotBuffer),
            };

            const mockContext = {
                pages: () => [mockPage],
            };

            const mockBrowser = {
                contexts: () => [mockContext],
                close: vi.fn(),
            };

            mockedScanApps.mockResolvedValue([
                {
                    port: 9222,
                    targets: [{ id: 'main', title: 'My App', url: 'file:///app/index.html', type: 'page' }],
                },
            ]);

            mockedChromium.connectOverCDP.mockResolvedValue(mockBrowser as any);

            const result = await takeScreenshot('/tmp/screenshot.png');

            expect(mockedWriteFile).toHaveBeenCalledWith('/tmp/screenshot.png', screenshotBuffer);
            expect(result.filePath).toBe('/tmp/screenshot.png');
        });

        it('should skip DevTools pages when looking for target page', async () => {
            const mainPage = {
                url: () => 'file:///app/index.html',
                title: () => Promise.resolve('My App'),
                screenshot: vi.fn().mockResolvedValue(Buffer.from('MAIN_PNG')),
            };

            const devToolsPage = {
                url: () => 'devtools://devtools/bundled/inspector.html',
                title: () => Promise.resolve('DevTools'),
                screenshot: vi.fn(),
            };

            const mockContext = {
                pages: () => [devToolsPage, mainPage],
            };

            const mockBrowser = {
                contexts: () => [mockContext],
                close: vi.fn(),
            };

            mockedScanApps.mockResolvedValue([
                {
                    port: 9222,
                    targets: [
                        { id: 'devtools', title: 'DevTools', url: 'devtools://devtools/bundled/inspector.html', type: 'page' },
                        { id: 'main', title: 'My App', url: 'file:///app/index.html', type: 'page' },
                    ],
                },
            ]);

            mockedChromium.connectOverCDP.mockResolvedValue(mockBrowser as any);

            await takeScreenshot();

            // Should have called screenshot on main page, not DevTools
            expect(mainPage.screenshot).toHaveBeenCalled();
            expect(devToolsPage.screenshot).not.toHaveBeenCalled();
        });

        it('should throw error when no browser contexts found', async () => {
            const mockBrowser = {
                contexts: () => [],
                close: vi.fn(),
            };

            mockedScanApps.mockResolvedValue([
                {
                    port: 9222,
                    targets: [{ id: 'main', title: 'My App', url: 'file:///app.html', type: 'page' }],
                },
            ]);

            mockedChromium.connectOverCDP.mockResolvedValue(mockBrowser as any);

            await expect(takeScreenshot()).rejects.toThrow('No browser contexts found');
        });

        it('should throw error when no pages found', async () => {
            const mockContext = {
                pages: () => [],
            };

            const mockBrowser = {
                contexts: () => [mockContext],
                close: vi.fn(),
            };

            mockedScanApps.mockResolvedValue([
                {
                    port: 9222,
                    targets: [{ id: 'main', title: 'My App', url: 'file:///app.html', type: 'page' }],
                },
            ]);

            mockedChromium.connectOverCDP.mockResolvedValue(mockBrowser as any);

            await expect(takeScreenshot()).rejects.toThrow('No pages found');
        });
    });
});
