import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type {
  ScreenshotFormat,
  ScreenshotOptions,
  ScreenshotResult,
  WindowTargetOptions,
} from '../../application/electron-automation';
import type { CdpClient } from './cdp-connection-pool';
import { CdpConnectionOpenError } from './cdp-session';
import type { DevToolsTarget } from './devtools-types';
import { resolveOutputPath } from './output-paths';

const OUTPUT_ALLOWLIST_VARIABLE = 'DEBUG_ELECTRON_MCP_OUTPUT_ROOTS';

interface ScreenshotCaptureResponse {
  readonly data: string;
}

interface ElementBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

interface ScreenshotClip {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/** What the caller asked for, and whether the window could not satisfy it. */
export interface ScreenshotClipReport {
  readonly selector: string;
  readonly width: number;
  readonly height: number;
  /** The element extended past the viewport and was cut down to fit. */
  readonly truncated?: boolean;
  readonly elementWidth?: number;
  readonly elementHeight?: number;
  /** False when capture fell back to a mode that ignores the clip. */
  readonly applied?: boolean;
}

export interface ScreenshotDependencies {
  readonly connections: {
    withSession<Result>(
      url: string,
      operation: (client: CdpClient) => Promise<Result>,
    ): Promise<Result>;
  };
  withTarget<Result>(
    options: WindowTargetOptions | undefined,
    operation: (target: DevToolsTarget) => Promise<Result>,
  ): Promise<Result>;
}

function isCaptureResponse(value: unknown): value is ScreenshotCaptureResponse {
  return (
    value !== null && typeof value === 'object' && 'data' in value && typeof value.data === 'string'
  );
}

function isElementBox(value: unknown): value is ElementBox {
  return (
    value !== null &&
    typeof value === 'object' &&
    'x' in value &&
    typeof value.x === 'number' &&
    'width' in value &&
    typeof value.width === 'number' &&
    'viewportWidth' in value &&
    typeof value.viewportWidth === 'number'
  );
}

/**
 * Reduce an element box to the part actually on screen.
 *
 * `getBoundingClientRect` happily reports boxes outside the viewport — an
 * element scrolled above the fold has a negative y, a wide table overflows
 * horizontally. `Page.captureScreenshot` does not reject such a clip, it
 * returns the whole window instead, silently answering a different question
 * than the caller asked.
 *
 * `truncated` compares the clamped edges against the original ones. Clamping
 * returns an operand unchanged when it does not bite, so an untouched edge is
 * exactly equal and needs no epsilon — which also means a sub-pixel crop is
 * still reported rather than rounded away.
 */
function clipToViewport(
  box: ElementBox,
): (ScreenshotClip & { readonly truncated: boolean }) | null {
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const right = Math.min(box.viewportWidth, box.x + box.width);
  const bottom = Math.min(box.viewportHeight, box.y + box.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    scale: 1,
    truncated:
      left > box.x || top > box.y || right < box.x + box.width || bottom < box.y + box.height,
  };
}

function mimeTypeFor(format: ScreenshotFormat): 'image/png' | 'image/jpeg' {
  return format === 'jpeg' ? 'image/jpeg' : 'image/png';
}
export async function takeScreenshot(
  options: ScreenshotOptions = {},
  { connections, withTarget }: ScreenshotDependencies,
): Promise<ScreenshotResult> {
  const format = options.format ?? 'png';
  const delivery = options.delivery ?? (options.outputPath ? 'file' : 'inline');
  const mimeType = mimeTypeFor(format);

  // Resolve the destination before capturing. A refused path must not cost a
  // round trip to the renderer, and reporting "sensitive location" is only
  // truthful if the guard actually ran.
  const filePath =
    delivery === 'file'
      ? resolveOutputPath(
          options.outputPath ?? path.join(os.tmpdir(), `debug-electron-${Date.now()}.png`),
          OUTPUT_ALLOWLIST_VARIABLE,
        )
      : undefined;

  try {
    const capture = await withTarget(options, async (target) => {
      if (!target.webSocketDebuggerUrl) {
        throw new CdpConnectionOpenError('No WebSocket debugger URL available.');
      }
      return connections.withSession(target.webSocketDebuggerUrl, async (client) => {
        const clip = options.selector ? await resolveClip(client, options.selector) : undefined;
        const response = await client.request('Page.captureScreenshot', {
          format,
          ...(format === 'jpeg' && options.quality !== undefined
            ? { quality: options.quality }
            : {}),
          ...(clip ? { clip, captureBeyondViewport: false } : {}),
        });
        return response;
      });
    });

    if (!isCaptureResponse(capture)) {
      throw new Error('DevTools Protocol returned a malformed screenshot response.');
    }

    const screenshotBuffer = Buffer.from(capture.data, 'base64');
    if (filePath) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, screenshotBuffer);
      return { kind: 'file', filePath, bytes: screenshotBuffer.length, mimeType };
    }

    return {
      kind: 'inline',
      base64: capture.data,
      bytes: screenshotBuffer.length,
      mimeType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Screenshot failed: ${message}. Make sure the Electron app is running with remote debugging enabled (--remote-debugging-port=9222)`,
      { cause: error },
    );
  }
}
async function resolveClip(client: CdpClient, selector: string): Promise<ScreenshotClip> {
  const evaluation = await client.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  })()`);
  const box = evaluation?.value;
  if (!isElementBox(box)) {
    throw new Error(`No visible element matches selector "${selector}".`);
  }
  const clip = clipToViewport(box);
  if (!clip) {
    throw new Error(
      `Element matched by "${selector}" is outside the viewport ` +
        `(rect ${Math.round(box.x)},${Math.round(box.y)} ` +
        `${Math.round(box.width)}x${Math.round(box.height)}; viewport ` +
        `${box.viewportWidth}x${box.viewportHeight}). Scroll it into view first.`,
    );
  }
  // `truncated` is caller-facing reporting, not a CDP clip field, and the
  // protocol rejects unknown clip properties.
  const { truncated: _truncated, ...geometry } = clip;
  return geometry;
}
