import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type {
  ActionTarget,
  ElectronAction,
  ElectronActionResult,
  KeyModifier,
  MouseButton,
  ProfileCapture,
  TraceCapture,
} from '../../application/electron-actions';
import { DEFAULT_TRACE_CATEGORIES_EXPORT as DEFAULT_TRACE_CATEGORIES } from '../../application/electron-actions';
import { parseElectronCommand } from '../../application/commands';
import { buildRendererCommand } from './renderer-command-builder';
import type { CdpClient } from './cdp-connection-pool';
import { CdpConnectionOpenError } from './cdp-session';
import type { DevToolsTarget } from './devtools-types';
import { resolveOutputPath } from './output-paths';

const OUTPUT_ALLOWLIST_VARIABLE = 'DEBUG_ELECTRON_MCP_OUTPUT_ROOTS';

/** How long to wait for the final trace batch after `Tracing.end`. */
const TRACE_COMPLETE_TIMEOUT_MS = 5_000;

/** Default V8 sampling interval. 1ms is DevTools' own default. */
const DEFAULT_PROFILE_INTERVAL_US = 1_000;

interface PendingTrace {
  readonly events: unknown[];
  readonly startedAt: number;
  readonly unsubscribe: () => void;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface KeyDescriptor {
  readonly key: string;
  readonly code?: string;
  readonly keyCode?: number;
  readonly text?: string;
}

interface ElectronActionRunnerInput {
  readonly actions: readonly ElectronAction[];
  readonly stopOnError: boolean;
  readonly target: DevToolsTarget;
}

interface ActionConnections {
  withSession<Result>(
    url: string,
    operation: (client: CdpClient) => Promise<Result>,
  ): Promise<Result>;
  /** Drop a pooled connection that can no longer be used. */
  invalidate?(url: string): Promise<void>;
}

export interface ElectronActionRunnerOptions {
  /** Called to release a connection after a pause wedged it. */
  readonly onConnectionWedge?: (url: string) => void;
}

export interface TraceResult {
  readonly filePath: string;
  readonly bytes: number;
  readonly eventCount: number;
  readonly elapsedMs: number;
  /** Set when the trace was recorded but could not be written. */
  readonly error?: string;
}

export interface ProfileResult {
  readonly filePath: string;
  readonly bytes: number;
  readonly elapsedMs: number;
  /** Set when the profile was recorded but could not be written. */
  readonly error?: string;
}

interface ElectronActionRunnerInput {
  readonly actions: readonly ElectronAction[];
  readonly stopOnError: boolean;
  readonly target: DevToolsTarget;
  readonly trace?: TraceCapture;
  readonly profile?: ProfileCapture;
}

export interface ElectronActionRunOutput {
  readonly results: readonly ElectronActionResult[];
  readonly trace?: TraceResult;
  readonly profile?: ProfileResult;
}

function isPoint(value: unknown): value is Point {
  return (
    value !== null &&
    typeof value === 'object' &&
    'x' in value &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    'y' in value &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  );
}

function readProperty(value: unknown, property: string): unknown {
  if (value === null || typeof value !== 'object' || !(property in value)) return undefined;
  return (value as Record<string, unknown>)[property];
}

function modifiersMask(modifiers: readonly KeyModifier[] | undefined): number {
  if (!modifiers) return 0;
  return modifiers.reduce((mask, modifier) => {
    switch (modifier) {
      case 'Alt':
        return mask | 1;
      case 'Control':
        return mask | 2;
      case 'Meta':
        return mask | 4;
      case 'Shift':
        return mask | 8;
      default: {
        const exhaustiveModifier: never = modifier;
        return exhaustiveModifier;
      }
    }
  }, 0);
}

function mouseButtonMask(button: MouseButton): number {
  switch (button) {
    case 'left':
      return 1;
    case 'right':
      return 2;
    case 'middle':
      return 4;
    default: {
      const exhaustiveButton: never = button;
      return exhaustiveButton;
    }
  }
}

const namedKeyDescriptors = new Map<string, KeyDescriptor>([
  ['Enter', { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' }],
  ['Escape', { key: 'Escape', code: 'Escape', keyCode: 27 }],
  ['Backspace', { key: 'Backspace', code: 'Backspace', keyCode: 8 }],
  ['Tab', { key: 'Tab', code: 'Tab', keyCode: 9 }],
  ['Space', { key: ' ', code: 'Space', keyCode: 32, text: ' ' }],
  ['Delete', { key: 'Delete', code: 'Delete', keyCode: 46 }],
  ['Insert', { key: 'Insert', code: 'Insert', keyCode: 45 }],
  ['Home', { key: 'Home', code: 'Home', keyCode: 36 }],
  ['End', { key: 'End', code: 'End', keyCode: 35 }],
  ['PageUp', { key: 'PageUp', code: 'PageUp', keyCode: 33 }],
  ['PageDown', { key: 'PageDown', code: 'PageDown', keyCode: 34 }],
  ['ArrowLeft', { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }],
  ['ArrowUp', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }],
  ['ArrowRight', { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }],
  ['ArrowDown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }],
]);

function keyDescriptor(key: string, modifiers: readonly KeyModifier[] | undefined): KeyDescriptor {
  const named = namedKeyDescriptors.get(key);
  const base =
    named ??
    (/^[a-z]$/i.test(key)
      ? { key, code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0) }
      : /^\d$/.test(key)
        ? { key, code: `Digit${key}`, keyCode: key.charCodeAt(0) }
        : { key });
  const emitsText = !modifiers?.some((modifier) => modifier !== 'Shift');
  const shiftedLetter = modifiers?.includes('Shift') && /^[a-z]$/i.test(base.key);
  const resolvedKey = shiftedLetter ? base.key.toUpperCase() : base.key;
  const text = emitsText ? (base.text ?? (key.length === 1 ? resolvedKey : undefined)) : undefined;
  return { ...base, key: resolvedKey, text };
}

function selectorPointExpression(selector: string): string {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  })()`;
}

function snapshotExpression(maxElements: number): string {
  return `(() => {
    const selector = (element) => {
      if (element.id) return '#' + CSS.escape(element.id);
      const parts = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
        const tag = current.tagName.toLowerCase();
        const siblings = current.parentElement
          ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName)
          : [];
        parts.unshift(siblings.length > 1 ? tag + ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')' : tag);
        current = current.parentElement;
      }
      return parts.join(' > ');
    };
    return Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      })
      .slice(0, ${maxElements})
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          role: element.getAttribute('role') || element.tagName.toLowerCase(),
          name: (element.getAttribute('aria-label') || element.textContent?.trim() || '').slice(0, 200),
          value: ('value' in element ? String(element.value ?? '') : '').slice(0, 200),
          enabled: !('disabled' in element) || !element.disabled,
          bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
          selector: selector(element),
        };
      });
  })()`;
}

export class ElectronActionRunner {
  private wedged = false;

  constructor(private readonly connections: ActionConnections) {}

  async run({
    actions,
    stopOnError,
    target,
    trace,
    profile,
  }: ElectronActionRunnerInput): Promise<ElectronActionRunOutput> {
    if (!target.webSocketDebuggerUrl) {
      throw new CdpConnectionOpenError('No WebSocket debugger URL available.');
    }
    const url = target.webSocketDebuggerUrl;

    const output = await this.connections.withSession(url, async (client) => {
      const results: ElectronActionResult[] = [];
      const collectTraceEvents = trace ? await this.beginTrace(client, trace) : undefined;
      // The profiler is started last so its startup cost is not attributed to
      // the interaction, and stopped first so the stop itself is not either.
      const profileStartedAt = profile ? await this.beginProfile(client, profile) : undefined;

      for (const [index, action] of actions.entries()) {
        try {
          const value = await this.execute(client, action);
          results.push({ index, kind: action.kind, ok: true, value });
          // A paused renderer answers nothing, so the connection is no longer
          // usable for any later action or for the next caller's request.
          if (action.kind === 'pause') this.wedged = true;
        } catch (error) {
          results.push({
            index,
            kind: action.kind,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
          if (stopOnError) break;
        }
      }

      // A capture that cannot be written must not discard the action results the
      // caller asked for, so a failure is reported alongside them.
      const traceResult =
        trace && collectTraceEvents
          ? await this.safeEndTrace(client, collectTraceEvents, trace)
          : undefined;
      const profileResult =
        profile && profileStartedAt !== undefined
          ? await this.safeEndProfile(client, profileStartedAt, profile)
          : undefined;

      return {
        results,
        ...(traceResult ? { trace: traceResult } : {}),
        ...(profileResult ? { profile: profileResult } : {}),
      };
    });

    // Evict after the lease is released, or the pool would hand the same dead
    // socket straight back to the next caller.
    if (this.wedged) {
      this.wedged = false;
      await this.connections.invalidate?.(url);
    }
    return output;
  }

  private async safeEndTrace(
    client: CdpClient,
    pending: PendingTrace,
    trace: TraceCapture,
  ): Promise<TraceResult> {
    try {
      return await this.endTrace(client, pending, trace);
    } catch (error) {
      return {
        filePath: '',
        bytes: 0,
        eventCount: pending.events.length,
        elapsedMs: Date.now() - pending.startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async safeEndProfile(
    client: CdpClient,
    startedAt: number,
    profile: ProfileCapture,
  ): Promise<ProfileResult> {
    try {
      return await this.endProfile(client, startedAt, profile);
    } catch (error) {
      return {
        filePath: '',
        bytes: 0,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async beginProfile(client: CdpClient, profile: ProfileCapture): Promise<number> {
    // Enabled first: Profiler.start fails on a target where the domain is off.
    await client.request('Profiler.enable');
    await client.request('Profiler.setSamplingInterval', {
      interval: profile.intervalUs ?? DEFAULT_PROFILE_INTERVAL_US,
    });
    await client.request('Profiler.start');
    return Date.now();
  }

  private async endProfile(
    client: CdpClient,
    startedAt: number,
    profile: ProfileCapture,
  ): Promise<ProfileResult> {
    try {
      // The profile object arrives in the stop response, not as an event, so a
      // final Profiler.stop is also what ends the domain for this target.
      const response = await client.request('Profiler.stop');
      const document = JSON.stringify({
        metadata: { stoppedAt: Date.now() },
        profile: readProperty(response, 'profile') ?? response,
      });
      const filePath = resolveOutputPath(
        profile.outputPath ??
          path.join(os.tmpdir(), `debug-electron-profile-${Date.now()}.cpuprofile`),
        OUTPUT_ALLOWLIST_VARIABLE,
      );
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, document);
      return {
        filePath,
        bytes: Buffer.byteLength(document),
        elapsedMs: Date.now() - startedAt,
      };
    } finally {
      await client.request('Profiler.disable').catch(() => undefined);
    }
  }

  private async beginTrace(client: CdpClient, trace: TraceCapture): Promise<PendingTrace> {
    const events: unknown[] = [];
    const startedAt = Date.now();
    const unsubscribe = client.on('Tracing.dataCollected', (params) => {
      const values = readProperty(params, 'value');
      if (Array.isArray(values)) events.push(...values);
    });
    await client.request('Tracing.start', {
      categories: trace.categories ?? DEFAULT_TRACE_CATEGORIES,
      transferMode: 'ReportEvents',
      options: 'record-as-much-as-possible',
    });
    return { events, startedAt, unsubscribe };
  }

  private async endTrace(
    client: CdpClient,
    pending: PendingTrace,
    trace: TraceCapture,
  ): Promise<TraceResult> {
    try {
      const completed = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, TRACE_COMPLETE_TIMEOUT_MS);
        timer.unref();
        client.on('Tracing.tracingComplete', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      await client.request('Tracing.end');
      await completed;
    } finally {
      pending.unsubscribe();
    }

    const filePath = resolveOutputPath(
      trace.outputPath ?? path.join(os.tmpdir(), `debug-electron-trace-${Date.now()}.json`),
      OUTPUT_ALLOWLIST_VARIABLE,
    );
    const document = JSON.stringify({
      metadata: {
        categories: trace.categories ?? DEFAULT_TRACE_CATEGORIES,
        startedAt: pending.startedAt,
        stoppedAt: Date.now(),
      },
      traceEvents: pending.events,
    });
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, document);

    return {
      filePath,
      bytes: Buffer.byteLength(document),
      eventCount: pending.events.length,
      elapsedMs: Date.now() - pending.startedAt,
    };
  }

  private async execute(client: CdpClient, action: ElectronAction): Promise<unknown> {
    switch (action.kind) {
      case 'snapshot':
        return this.evaluateValue(client, snapshotExpression(action.maxElements ?? 100));
      case 'click':
        return this.click(client, action.target, action.button ?? 'left');
      case 'double_click':
        return this.doubleClick(client, action.target, action.button ?? 'left');
      case 'long_press':
        return this.longPress(client, action.target, action.durationMs ?? 500);
      case 'hover': {
        const point = await this.resolvePoint(client, action.target);
        return client.request('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          ...point,
          button: 'none',
          buttons: 0,
        });
      }
      case 'scroll': {
        const point = action.target
          ? await this.resolvePoint(client, action.target)
          : await this.viewportCenter(client);
        return client.request('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          ...point,
          buttons: 0,
          deltaX: action.deltaX ?? 0,
          deltaY: action.deltaY,
        });
      }
      case 'type_text':
        if (action.selector)
          await this.click(client, { kind: 'selector', selector: action.selector }, 'left');
        return client.request('Input.insertText', { text: action.text });
      case 'press_key':
        return this.pressKey(client, action.key, action.modifiers);
      case 'open_url':
        return client.request('Page.navigate', { url: this.validatedUrl(action.url) });
      case 'reload':
        return client.request('Page.reload', { ignoreCache: action.ignoreCache ?? false });
      case 'pause':
        // Debugger.enable is required once per session before pause is honoured.
        await client.request('Debugger.enable');
        await client.request('Debugger.pause');
        return { paused: true };
      case 'resume':
        await client.request('Debugger.enable');
        // A paused renderer cannot service the Runtime request this would
        // otherwise wait on, so the reply is deliberately not awaited: the
        // command is queued and answered once execution resumes. Awaiting it
        // would block until the client request timeout.
        void client.request('Debugger.resume').catch(() => undefined);
        return { resuming: true };
      case 'get_cookies': {
        await client.request('Network.enable');
        const response = await client.request(
          'Network.getCookies',
          action.urls?.length ? { urls: action.urls } : {},
        );
        return { cookies: readProperty(response, 'cookies') ?? [] };
      }
      case 'set_cookie': {
        await client.request('Network.enable');
        const response = await client.request('Network.setCookie', {
          name: action.name,
          value: action.value,
          ...(action.url === undefined ? {} : { url: action.url }),
          ...(action.domain === undefined ? {} : { domain: action.domain }),
          ...(action.path === undefined ? {} : { path: action.path }),
          ...(action.secure === undefined ? {} : { secure: action.secure }),
          ...(action.httpOnly === undefined ? {} : { httpOnly: action.httpOnly }),
          ...(action.sameSite === undefined ? {} : { sameSite: action.sameSite }),
          ...(action.expires === undefined ? {} : { expires: action.expires }),
        });
        return { success: readProperty(response, 'success') === true };
      }
      case 'get_storage':
        return this.evaluateValue(
          client,
          `(() => {
            const store = window[${JSON.stringify(action.store ?? 'localStorage')}];
            if (!store) return {};
            const entries = {};
            for (let index = 0; index < store.length; index += 1) {
              const key = store.key(index);
              if (key !== null) entries[key] = store.getItem(key);
            }
            return entries;
          })()`,
        );
      case 'set_storage':
        return this.evaluateValue(
          client,
          `(() => {
            const store = window[${JSON.stringify(action.store ?? 'localStorage')}];
            if (!store) throw new Error('${action.store ?? 'localStorage'} is unavailable');
            if (${action.clear === true ? 'true' : 'false'}) store.clear();
            const entries = ${JSON.stringify(action.entries)};
            for (const [key, value] of Object.entries(entries)) store.setItem(key, String(value));
            return { store: ${JSON.stringify(action.store ?? 'localStorage')}, keys: Object.keys(entries) };
          })()`,
        );
      case 'command':
        return client.evaluate(
          buildRendererCommand(parseElectronCommand(action.command, action.args)),
        );
      default: {
        const exhaustiveAction: never = action;
        return exhaustiveAction;
      }
    }
  }

  private async resolvePoint(client: CdpClient, target: ActionTarget): Promise<Point> {
    if (target.kind === 'coordinates') return { x: target.x, y: target.y };
    const value = await this.evaluateValue(client, selectorPointExpression(target.selector));
    if (!isPoint(value))
      throw new Error(`No visible element matches selector "${target.selector}".`);
    return value;
  }

  private async viewportCenter(client: CdpClient): Promise<Point> {
    const value = await this.evaluateValue(
      client,
      '({ x: window.innerWidth / 2, y: window.innerHeight / 2 })',
    );
    if (!isPoint(value)) throw new Error('Could not read the Electron viewport size.');
    return value;
  }

  private async click(
    client: CdpClient,
    target: ActionTarget,
    button: 'left' | 'middle' | 'right',
    clickCount: 1 | 2 = 1,
  ): Promise<unknown> {
    const point = await this.resolvePoint(client, target);
    const buttons = mouseButtonMask(button);
    const requests: Promise<unknown>[] = [
      client.request('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        ...point,
        button: 'none',
        buttons: 0,
      }),
    ];
    for (let currentCount = 1; currentCount <= clickCount; currentCount += 1) {
      requests.push(
        client.request('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...point,
          button,
          buttons,
          clickCount: currentCount,
        }),
        client.request('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...point,
          button,
          buttons: 0,
          clickCount: currentCount,
        }),
      );
    }
    return (await Promise.all(requests)).at(-1);
  }

  private async doubleClick(
    client: CdpClient,
    target: ActionTarget,
    button: 'left' | 'middle' | 'right',
  ): Promise<unknown> {
    return this.click(client, target, button, 2);
  }

  private async longPress(
    client: CdpClient,
    target: ActionTarget,
    durationMs: number,
  ): Promise<unknown> {
    const point = await this.resolvePoint(client, target);
    await client.request('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...point,
      button: 'none',
      buttons: 0,
    });
    await client.request('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...point,
      button: 'left',
      buttons: mouseButtonMask('left'),
      clickCount: 1,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
    return client.request('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...point,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
  }

  private async pressKey(
    client: CdpClient,
    key: string,
    modifiers: readonly KeyModifier[] | undefined,
  ): Promise<unknown> {
    const modifierMask = modifiersMask(modifiers);
    const descriptor = keyDescriptor(key, modifiers);
    await client.request('Input.dispatchKeyEvent', {
      type: descriptor.text ? 'keyDown' : 'rawKeyDown',
      key: descriptor.key,
      code: descriptor.code,
      windowsVirtualKeyCode: descriptor.keyCode,
      modifiers: modifierMask,
      text: descriptor.text,
      unmodifiedText: descriptor.text,
    });
    return client.request('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: descriptor.key,
      code: descriptor.code,
      windowsVirtualKeyCode: descriptor.keyCode,
      modifiers: modifierMask,
    });
  }

  private async evaluateValue(client: CdpClient, expression: string): Promise<unknown> {
    const evaluation = await client.evaluate(expression);
    return evaluation?.value;
  }

  private validatedUrl(url: string): string {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid navigation URL "${url}".`);
    }
    const blockedProtocols = new Set([
      'about:',
      'blob:',
      'chrome:',
      'chrome-extension:',
      'data:',
      'devtools:',
      'edge:',
      'javascript:',
      'view-source:',
    ]);
    if (blockedProtocols.has(parsed.protocol)) {
      throw new Error(`Navigation URL protocol "${parsed.protocol}" is not allowed.`);
    }
    return parsed.href;
  }
}
