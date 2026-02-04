import { chromium } from 'playwright';
import * as fs from 'fs/promises';
import { logger } from './utils/logger';
import { scanForElectronApps } from './utils/electron-discovery';
import { WindowTargetOptions } from './utils/electron-connection';

/** Options for taking a screenshot */
export interface ScreenshotOptions {
  /** Path to save the screenshot (optional, defaults to in-memory only) */
  outputPath?: string;
  /** CDP target ID to screenshot a specific window (exact match, takes priority over windowTitle) */
  targetId?: string;
  /** Window title to screenshot (case-insensitive partial match) */
  windowTitle?: string;
}

/**
 * Take a screenshot of the running Electron application using Chrome DevTools Protocol
 */
export async function takeScreenshot(
  options: ScreenshotOptions = {},
): Promise<{
  filePath?: string;
  base64: string;
  data: string;
  error?: string;
}> {
  const { outputPath, targetId, windowTitle } = options;

  logger.info('📸 Taking screenshot of Electron application', {
    outputPath,
    targetId,
    windowTitle,
    timestamp: new Date().toISOString(),
  });

  try {
    // Find running Electron applications
    const apps = await scanForElectronApps();
    if (apps.length === 0) {
      throw new Error('No running Electron applications found with remote debugging enabled');
    }

    // Find target app and target based on options
    // Priority: targetId > windowTitle > first available window
    let targetApp = apps[0];
    let targetInfo: { port: number; targetId?: string } | null = null;

    if (targetId) {
      // Search for exact targetId match across all apps
      for (const app of apps) {
        const match = app.targets.find((t: any) => t.id === targetId);
        if (match) {
          targetApp = app;
          targetInfo = { port: app.port, targetId: match.id };
          logger.debug(`Found target by ID "${targetId}" on port ${app.port}`);
          break;
        }
      }
      if (!targetInfo) {
        throw new Error(
          `No window found with targetId "${targetId}". Use list_electron_windows to see available targets.`,
        );
      }
    } else if (windowTitle) {
      // Search for case-insensitive partial title match
      const searchTitle = windowTitle.toLowerCase();
      for (const app of apps) {
        const match = app.targets.find(
          (t: any) => t.title && t.title.toLowerCase().includes(searchTitle),
        );
        if (match) {
          targetApp = app;
          targetInfo = { port: app.port, targetId: match.id };
          logger.debug(`Found target by title "${windowTitle}" on port ${app.port}`);
          break;
        }
      }
      if (!targetInfo) {
        throw new Error(
          `No window found with title matching "${windowTitle}". Use list_electron_windows to see available targets.`,
        );
      }
    }

    // Connect to the Electron app's debugging port
    const browser = await chromium.connectOverCDP(`http://localhost:${targetApp.port}`);
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      throw new Error(
        'No browser contexts found - make sure Electron app is running with remote debugging enabled',
      );
    }

    const context = contexts[0];
    const pages = context.pages();

    if (pages.length === 0) {
      throw new Error('No pages found in the browser context');
    }

    // Find the target page
    let targetPage = pages[0];

    if (targetInfo?.targetId) {
      // If we found a specific target, try to find the matching page
      // Note: We need to find the page by URL/title since CDP targetId doesn't directly map to Playwright pages
      const targetData = targetApp.targets.find((t: any) => t.id === targetInfo!.targetId);
      if (targetData) {
        for (const page of pages) {
          const pageUrl = page.url();
          // Match by URL since that's more reliable than title
          if (pageUrl === targetData.url) {
            targetPage = page;
            break;
          }
        }
      }
    } else {
      // Find the main application page (skip DevTools pages)
      for (const page of pages) {
        const url = page.url();
        const title = await page.title().catch(() => '');

        // Skip DevTools and about:blank pages
        if (
          !url.includes('devtools://') &&
          !url.includes('about:blank') &&
          title &&
          !title.includes('DevTools')
        ) {
          targetPage = page;
          break;
        }
      }
    }

    logger.info(`Taking screenshot of page: ${targetPage.url()} (${await targetPage.title()})`);

    // Take screenshot as buffer (in memory)
    const screenshotBuffer = await targetPage.screenshot({
      type: 'png',
      fullPage: false,
    });

    await browser.close();

    // Convert buffer to base64 for transmission
    const base64Data = screenshotBuffer.toString('base64');
    logger.info(`Screenshot captured successfully (${screenshotBuffer.length} bytes)`);

    // If outputPath is provided, save to file
    if (outputPath) {
      await fs.writeFile(outputPath, screenshotBuffer);
      return {
        filePath: outputPath,
        base64: base64Data,
        data: `Screenshot saved to: ${outputPath}`,
      };
    } else {
      return {
        base64: base64Data,
        data: `Screenshot captured as base64 data (${screenshotBuffer.length} bytes)`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Screenshot failed: ${errorMessage}. Make sure the Electron app is running with remote debugging enabled (--remote-debugging-port=9222)`,
    );
  }
}
