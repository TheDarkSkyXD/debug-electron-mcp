import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/screenshot', () => ({
  takeScreenshot: vi.fn().mockResolvedValue({
    kind: 'inline',
    base64: Buffer.from('inline-image').toString('base64'),
    bytes: Buffer.byteLength('inline-image'),
  }),
}));

import { startHttpServer, type RunningHttpServer } from '../../src/serve';

const protocolVersion = '2026-07-28';

function requestMeta() {
  return {
    'io.modelcontextprotocol/protocolVersion': protocolVersion,
    'io.modelcontextprotocol/clientCapabilities': {},
    'io.modelcontextprotocol/clientInfo': {
      name: 'debug-electron-mcp-test',
      version: '1.0.0',
    },
  };
}

describe('MCP 2026 HTTP transport', () => {
  let running: RunningHttpServer | undefined;

  afterEach(async () => {
    await running?.close();
    running = undefined;
  });

  async function call(
    method: string,
    params: Record<string, unknown>,
    id: number,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    if (!running) throw new Error('HTTP test server is not running.');
    const requestName = typeof params.name === 'string' ? params.name : 'debug-electron-mcp-test';
    return fetch(`http://127.0.0.1:${running.port}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'mcp-protocol-version': protocolVersion,
        'mcp-method': method,
        'mcp-name': requestName,
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params: { ...params, _meta: requestMeta() },
      }),
    });
  }

  it('serves deterministic stateless MCP 2026 requests and rejects legacy traffic', async () => {
    running = await startHttpServer(0);

    const discover = await call('server/discover', {}, 1);
    const discoverBody = await discover.json();
    expect(discover.status).toBe(200);
    expect(discoverBody.result.supportedVersions).toContain(protocolVersion);

    const firstList = await call('tools/list', {}, 2, {
      'mcp-session-id': 'must-be-ignored',
    });
    const firstListText = await firstList.text();
    const secondList = await call('tools/list', {}, 2);
    const secondListText = await secondList.text();
    expect(firstList.status).toBe(200);
    expect(firstList.headers.has('mcp-session-id')).toBe(false);
    expect(secondList.status).toBe(200);
    expect(secondListText).toBe(firstListText);

    const missingHeaders = await fetch(`http://127.0.0.1:${running.port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: { _meta: requestMeta() },
      }),
    });
    expect(missingHeaders.status).toBeGreaterThanOrEqual(400);

    const legacy = await call(
      'initialize',
      {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'legacy-client', version: '1.0.0' },
      },
      4,
    );
    expect(legacy.status).toBeGreaterThanOrEqual(400);

    const getResponse = await fetch(`http://127.0.0.1:${running.port}/mcp`);
    expect(getResponse.status).toBe(405);

    const screenshot = await call(
      'tools/call',
      { name: 'take_screenshot', arguments: { delivery: 'inline' } },
      5,
    );
    const screenshotBody = await screenshot.json();
    expect(screenshot.status).toBe(200);
    expect(screenshotBody.result.content).toContainEqual(
      expect.objectContaining({ type: 'image', data: Buffer.from('inline-image').toString('base64') }),
    );
    expect(screenshotBody.result.structuredContent).toEqual({
      ok: true,
      data: { kind: 'inline', bytes: Buffer.byteLength('inline-image') },
    });
  });
});
