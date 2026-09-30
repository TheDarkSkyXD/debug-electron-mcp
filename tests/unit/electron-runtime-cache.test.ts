import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { createServer as createTcpServer, type Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { CdpConnectionPool } from '../../src/adapters/electron/cdp-connection-pool';
import { ElectronDiscoveryCache } from '../../src/adapters/electron/discovery-cache';
import type { ElectronAppInfo } from '../../src/adapters/electron/devtools-types';
import { createElectronAutomation } from '../../src/adapters/electron/electron-automation';

const discoveredApp: ElectronAppInfo = {
  port: 9222,
  targets: [
    {
      id: 'target-1',
      title: 'Test window',
      type: 'page',
      webSocketDebuggerUrl: 'ws://127.0.0.1/devtools/page/target-1',
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

async function createCdpServer(evaluationDelayMs = 0): Promise<{
  readonly server: WebSocketServer;
  readonly url: string;
  readonly connectionCount: () => number;
  readonly evaluationCount: () => number;
  readonly methods: () => readonly string[];
}> {
  let connections = 0;
  let evaluations = 0;
  const methods: string[] = [];
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Test WebSocket server did not bind to a TCP port.');
  }

  server.on('connection', (socket) => {
    connections += 1;
    socket.on('message', (data) => {
      const request: unknown = JSON.parse(data.toString());
      if (!isRecord(request) || typeof request.id !== 'number') return;
      if (typeof request.method === 'string') methods.push(request.method);

      if (request.method === 'Runtime.evaluate') {
        evaluations += 1;
        const expression =
          isRecord(request.params) && typeof request.params.expression === 'string'
            ? request.params.expression
            : '';
        const value = expression.includes('window.innerWidth') ? { x: 400, y: 300 } : evaluations;
        const response = JSON.stringify({
          id: request.id,
          result: { result: { type: typeof value === 'number' ? 'number' : 'object', value } },
        });
        if (evaluationDelayMs > 0) {
          setTimeout(() => socket.send(response), evaluationDelayMs);
        } else {
          socket.send(response);
        }
        return;
      }

      if (request.method === 'Page.captureScreenshot') {
        socket.send(
          JSON.stringify({
            id: request.id,
            result: { data: Buffer.from('PNG_DATA').toString('base64') },
          }),
        );
        return;
      }

      socket.send(JSON.stringify({ id: request.id, result: {} }));
    });
  });

  return {
    server,
    url: `ws://127.0.0.1:${address.port}`,
    connectionCount: () => connections,
    evaluationCount: () => evaluations,
    methods: () => methods,
  };
}

async function closeCdpServer(server: WebSocketServer): Promise<void> {
  for (const client of server.clients) client.terminate();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function createDiscoveryServer(webSocketDebuggerUrl: string): Promise<{
  readonly server: Server;
  readonly port: number;
  readonly requestCount: () => number;
  readonly setWebSocketDebuggerUrl: (url: string) => void;
}> {
  let requests = 0;
  let activeWebSocketDebuggerUrl = webSocketDebuggerUrl;
  const server = createServer((request, response) => {
    if (request.url !== '/json') {
      response.writeHead(404).end();
      return;
    }
    requests += 1;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify([
        {
          id: 'target-1',
          title: 'Test window',
          type: 'page',
          webSocketDebuggerUrl: activeWebSocketDebuggerUrl,
        },
      ]),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Test discovery server did not bind to a TCP port.');
  }
  return {
    server,
    port: address.port,
    requestCount: () => requests,
    setWebSocketDebuggerUrl: (url) => {
      activeWebSocketDebuggerUrl = url;
    },
  };
}

async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe('Electron discovery cache', () => {
  it('coalesces concurrent scans and reuses the result until its TTL expires', async () => {
    let now = 1_000;
    const probe = vi.fn().mockResolvedValue([discoveredApp]);
    const cache = new ElectronDiscoveryCache({
      probe,
      ttlMs: 500,
      maxEntries: 4,
      now: () => now,
    });

    const [first, second] = await Promise.all([cache.scan([9222]), cache.scan([9222])]);
    const third = await cache.scan([9222]);

    expect(first).toEqual([discoveredApp]);
    expect(second).toEqual([discoveredApp]);
    expect(third).toEqual([discoveredApp]);
    expect(probe).toHaveBeenCalledTimes(1);

    now += 501;
    await cache.scan([9222]);

    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('bounds cached port selections and can invalidate one selection', async () => {
    const probe = vi.fn().mockResolvedValue([discoveredApp]);
    const cache = new ElectronDiscoveryCache({ probe, ttlMs: 5_000, maxEntries: 1 });

    await cache.scan([9222]);
    await cache.scan([9223]);
    await cache.scan([9222]);
    cache.invalidate([9222]);
    await cache.scan([9222]);

    expect(probe).toHaveBeenCalledTimes(4);
  });
});

describe('CDP connection pool', () => {
  const servers: WebSocketServer[] = [];
  const pools: CdpConnectionPool[] = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.close()));
    await Promise.all(servers.splice(0).map(closeCdpServer));
  });

  it('reuses one connection for sequential and concurrent evaluations', async () => {
    const cdp = await createCdpServer();
    servers.push(cdp.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 4 });
    pools.push(pool);

    const first = await pool.evaluate(cdp.url, '1 + 1');
    const [second, third] = await Promise.all([
      pool.evaluate(cdp.url, '2 + 2'),
      pool.evaluate(cdp.url, '3 + 3'),
    ]);

    expect(first?.value).toBe(1);
    expect(second?.value).toBe(2);
    expect(third?.value).toBe(3);
    expect(cdp.connectionCount()).toBe(1);
    expect(cdp.evaluationCount()).toBe(3);
  });

  it('coalesces concurrent cold evaluations onto one connection', async () => {
    const cdp = await createCdpServer();
    servers.push(cdp.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 4 });
    pools.push(pool);

    await Promise.all([
      pool.evaluate(cdp.url, '1'),
      pool.evaluate(cdp.url, '2'),
      pool.evaluate(cdp.url, '3'),
    ]);

    expect(cdp.connectionCount()).toBe(1);
    expect(cdp.evaluationCount()).toBe(3);
  });

  it('keeps one leased session for a complete CDP request operation', async () => {
    const cdp = await createCdpServer();
    servers.push(cdp.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 4 });
    pools.push(pool);

    const result = await pool.withSession(cdp.url, async (client) => {
      await client.request('Page.enable');
      await client.request('Page.captureScreenshot', { format: 'png' });
      return 'captured';
    });

    expect(result).toBe('captured');
    expect(cdp.connectionCount()).toBe(1);
    expect(cdp.methods()).toEqual(['Runtime.enable', 'Page.enable', 'Page.captureScreenshot']);
  });

  it('evicts a malformed CDP transport and identifies the interrupted method', async () => {
    let connections = 0;
    let sentMalformedResponse = false;
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Test WebSocket server did not bind to a TCP port.');
    }
    server.on('connection', (socket) => {
      connections += 1;
      socket.on('message', (data) => {
        const request: unknown = JSON.parse(data.toString());
        if (!isRecord(request) || typeof request.id !== 'number') return;
        if (request.method === 'Page.enable' && !sentMalformedResponse) {
          sentMalformedResponse = true;
          socket.send('{malformed');
          return;
        }
        socket.send(JSON.stringify({ id: request.id, result: {} }));
      });
    });
    const pool = new CdpConnectionPool();

    try {
      await expect(
        pool.withSession(`ws://127.0.0.1:${address.port}`, (client) =>
          client.request('Page.enable'),
        ),
      ).rejects.toThrow(/Page\.enable/);
      await pool.withSession(`ws://127.0.0.1:${address.port}`, (client) =>
        client.request('Page.getLayoutMetrics'),
      );

      expect(connections).toBe(2);
    } finally {
      await pool.close();
      await closeCdpServer(server);
    }
  });

  it('keeps the hard capacity limit during concurrent cold evaluations', async () => {
    const firstServer = await createCdpServer(25);
    const secondServer = await createCdpServer(25);
    servers.push(firstServer.server, secondServer.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 1 });
    pools.push(pool);

    const results = await Promise.allSettled([
      pool.evaluate(firstServer.url, '1'),
      pool.evaluate(secondServer.url, '2'),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(firstServer.connectionCount() + secondServer.connectionCount()).toBe(1);
  });

  it('times out and cancels an opening connection', async () => {
    const sockets = new Set<Socket>();
    const server = createTcpServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Test TCP server did not bind to a port.');
    }
    const pool = new CdpConnectionPool({
      connectionTimeoutMs: 20,
      idleTtlMs: 5_000,
      maxConnections: 1,
    });

    try {
      const startedAt = performance.now();
      await expect(pool.evaluate(`ws://127.0.0.1:${address.port}`, '1')).rejects.toThrow(
        'timed out',
      );
      await pool.close();
      expect(performance.now() - startedAt).toBeLessThan(500);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('cancels an opening connection during pool shutdown', async () => {
    const sockets = new Set<Socket>();
    const server = createTcpServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Test TCP server did not bind to a port.');
    }
    const pool = new CdpConnectionPool({
      connectionTimeoutMs: 5_000,
      idleTtlMs: 5_000,
      maxConnections: 1,
    });

    try {
      const evaluation = pool.evaluate(`ws://127.0.0.1:${address.port}`, '1');
      void evaluation.catch(() => undefined);
      while (sockets.size === 0) await new Promise(setImmediate);
      const startedAt = performance.now();
      await pool.close();

      await expect(evaluation).rejects.toThrow('cancelled');
      expect(performance.now() - startedAt).toBeLessThan(500);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('evicts a closed connection and reconnects on the next evaluation', async () => {
    const cdp = await createCdpServer();
    servers.push(cdp.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 4 });
    pools.push(pool);

    await pool.evaluate(cdp.url, '1 + 1');
    const activeClient = cdp.server.clients.values().next().value;
    if (!activeClient) throw new Error('Expected an active test connection.');
    activeClient.close();
    await once(activeClient, 'close');

    await pool.evaluate(cdp.url, '2 + 2');

    expect(cdp.connectionCount()).toBe(2);
  });

  it('coalesces concurrent evaluations after a remote close', async () => {
    const cdp = await createCdpServer();
    servers.push(cdp.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 4 });
    pools.push(pool);

    await pool.evaluate(cdp.url, '1');
    const activeClient = cdp.server.clients.values().next().value;
    if (!activeClient) throw new Error('Expected an active test connection.');
    activeClient.close();
    await once(activeClient, 'close');

    await Promise.all([
      pool.evaluate(cdp.url, '2'),
      pool.evaluate(cdp.url, '3'),
      pool.evaluate(cdp.url, '4'),
    ]);

    expect(cdp.connectionCount()).toBe(2);
    expect(cdp.evaluationCount()).toBe(4);
  });

  it('evicts idle connections after the configured TTL', async () => {
    const cdp = await createCdpServer();
    servers.push(cdp.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 20, maxConnections: 4 });
    pools.push(pool);

    await pool.evaluate(cdp.url, '1 + 1');
    const activeClient = cdp.server.clients.values().next().value;
    if (!activeClient) throw new Error('Expected an active test connection.');
    await once(activeClient, 'close');
    await pool.evaluate(cdp.url, '2 + 2');

    expect(cdp.connectionCount()).toBe(2);
  });

  it('evicts the least recently used connection at capacity', async () => {
    const firstServer = await createCdpServer();
    const secondServer = await createCdpServer();
    servers.push(firstServer.server, secondServer.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 1 });
    pools.push(pool);

    await pool.evaluate(firstServer.url, '1');
    const firstClient = firstServer.server.clients.values().next().value;
    if (!firstClient) throw new Error('Expected the first test connection.');
    const firstClose = once(firstClient, 'close');
    await pool.evaluate(secondServer.url, '2');
    await firstClose;

    expect(firstServer.server.clients.size).toBe(0);
    expect(secondServer.server.clients.size).toBe(1);
  });

  it('does not evict an active evaluation to make room', async () => {
    const firstServer = await createCdpServer(50);
    const secondServer = await createCdpServer();
    servers.push(firstServer.server, secondServer.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 1 });
    pools.push(pool);

    const activeEvaluation = pool.evaluate(firstServer.url, '1');
    while (firstServer.evaluationCount() === 0) await new Promise(setImmediate);

    await expect(pool.evaluate(secondServer.url, '2')).rejects.toThrow(
      'Every pooled CDP connection is active.',
    );
    await expect(activeEvaluation).resolves.toMatchObject({ value: 1 });
    expect(firstServer.server.clients.size).toBe(1);
    expect(secondServer.connectionCount()).toBe(0);
  });

  it('closes every retained connection during shutdown', async () => {
    const firstServer = await createCdpServer();
    const secondServer = await createCdpServer();
    servers.push(firstServer.server, secondServer.server);
    const pool = new CdpConnectionPool({ idleTtlMs: 5_000, maxConnections: 2 });

    await pool.evaluate(firstServer.url, '1');
    await pool.evaluate(secondServer.url, '2');
    const remoteCloseEvents = [firstServer.server, secondServer.server].flatMap((server) =>
      [...server.clients].map((client) => once(client, 'close')),
    );
    await pool.close();
    await Promise.all(remoteCloseEvents);

    expect(firstServer.server.clients.size).toBe(0);
    expect(secondServer.server.clients.size).toBe(0);
  });
});

describe('warm Electron automation path', () => {
  it('resolves the DevTools target once and leases one connection for an action batch', async () => {
    const cdp = await createCdpServer();
    const discovery = await createDiscoveryServer(cdp.url);
    const automation = createElectronAutomation();

    try {
      const { results } = await automation.performActions({
        target: { ports: [discovery.port] },
        stopOnError: true,
        actions: [
          { kind: 'click', target: { kind: 'coordinates', x: 10, y: 20 } },
          { kind: 'scroll', deltaY: 100 },
        ],
      });

      expect(results.map((result) => result.ok)).toEqual([true, true]);
      expect(discovery.requestCount()).toBe(1);
      expect(cdp.connectionCount()).toBe(1);
      expect(cdp.methods()).toEqual([
        'Runtime.enable',
        'Input.dispatchMouseEvent',
        'Input.dispatchMouseEvent',
        'Input.dispatchMouseEvent',
        'Runtime.evaluate',
        'Input.dispatchMouseEvent',
      ]);
    } finally {
      await automation.close();
      await closeHttpServer(discovery.server);
      await closeCdpServer(cdp.server);
    }
  });

  it('reuses one CDP connection for sequential screenshots', async () => {
    const cdp = await createCdpServer();
    const discovery = await createDiscoveryServer(cdp.url);
    const automation = createElectronAutomation();

    try {
      const first = await automation.takeScreenshot({ ports: [discovery.port] });
      const second = await automation.takeScreenshot({ ports: [discovery.port] });

      expect(first).toMatchObject({ kind: 'inline', bytes: Buffer.byteLength('PNG_DATA') });
      expect(second).toMatchObject({ kind: 'inline', bytes: Buffer.byteLength('PNG_DATA') });
      expect(discovery.requestCount()).toBe(1);
      expect(cdp.connectionCount()).toBe(1);
      expect(cdp.methods().filter((method) => method === 'Page.captureScreenshot')).toHaveLength(2);
    } finally {
      await automation.close();
      await closeHttpServer(discovery.server);
      await closeCdpServer(cdp.server);
    }
  });

  it('refreshes stale discovery before an action batch starts', async () => {
    const firstCdp = await createCdpServer();
    const secondCdp = await createCdpServer();
    const discovery = await createDiscoveryServer(firstCdp.url);
    const automation = createElectronAutomation();
    let firstServerClosed = false;

    try {
      await automation.listWindows({ includeDevTools: false, ports: [discovery.port] });
      discovery.setWebSocketDebuggerUrl(secondCdp.url);
      await closeCdpServer(firstCdp.server);
      firstServerClosed = true;

      const { results } = await automation.performActions({
        target: { ports: [discovery.port] },
        stopOnError: true,
        actions: [{ kind: 'click', target: { kind: 'coordinates', x: 10, y: 20 } }],
      });

      expect(results.map((result) => result.ok)).toEqual([true]);
      expect(discovery.requestCount()).toBe(2);
      expect(secondCdp.connectionCount()).toBe(1);
      expect(secondCdp.methods()).toEqual([
        'Runtime.enable',
        'Input.dispatchMouseEvent',
        'Input.dispatchMouseEvent',
        'Input.dispatchMouseEvent',
      ]);
    } finally {
      await automation.close();
      await closeHttpServer(discovery.server);
      if (!firstServerClosed) await closeCdpServer(firstCdp.server);
      await closeCdpServer(secondCdp.server);
    }
  });

  it('refreshes stale discovery before capturing a screenshot', async () => {
    const firstCdp = await createCdpServer();
    const secondCdp = await createCdpServer();
    const discovery = await createDiscoveryServer(firstCdp.url);
    const automation = createElectronAutomation();
    let firstServerClosed = false;

    try {
      await automation.listWindows({ includeDevTools: false, ports: [discovery.port] });
      discovery.setWebSocketDebuggerUrl(secondCdp.url);
      await closeCdpServer(firstCdp.server);
      firstServerClosed = true;

      const result = await automation.takeScreenshot({ ports: [discovery.port] });

      expect(result).toMatchObject({ kind: 'inline', bytes: Buffer.byteLength('PNG_DATA') });
      expect(discovery.requestCount()).toBe(2);
      expect(secondCdp.connectionCount()).toBe(1);
      expect(secondCdp.methods()).toEqual(['Runtime.enable', 'Page.captureScreenshot']);
    } finally {
      await automation.close();
      await closeHttpServer(discovery.server);
      if (!firstServerClosed) await closeCdpServer(firstCdp.server);
      await closeCdpServer(secondCdp.server);
    }
  });

  it('reuses discovery and CDP across sequential application calls', async () => {
    const cdp = await createCdpServer();
    const discovery = await createDiscoveryServer(cdp.url);
    const automation = createElectronAutomation();

    try {
      const first = await automation.executeCommand({
        request: { command: 'get_title', args: {} },
        target: { ports: [discovery.port] },
      });
      const second = await automation.executeCommand({
        request: { command: 'get_title', args: {} },
        target: { ports: [discovery.port] },
      });

      expect(first).toBe('Result: 1');
      expect(second).toBe('Result: 2');
      expect(discovery.requestCount()).toBe(1);
      expect(cdp.connectionCount()).toBe(1);
      expect(cdp.evaluationCount()).toBe(2);
    } finally {
      await automation.close();
      await closeHttpServer(discovery.server);
      await closeCdpServer(cdp.server);
    }
  });

  it('refreshes stale discovery after a pooled target disappears', async () => {
    const firstCdp = await createCdpServer();
    const secondCdp = await createCdpServer();
    const discovery = await createDiscoveryServer(firstCdp.url);
    const automation = createElectronAutomation();
    let firstServerClosed = false;

    try {
      await automation.executeCommand({
        request: { command: 'get_title', args: {} },
        target: { ports: [discovery.port] },
      });
      discovery.setWebSocketDebuggerUrl(secondCdp.url);
      await closeCdpServer(firstCdp.server);
      firstServerClosed = true;
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await automation.executeCommand({
        request: { command: 'get_title', args: {} },
        target: { ports: [discovery.port] },
      });

      expect(result).toBe('Result: 1');
      expect(discovery.requestCount()).toBe(2);
      expect(secondCdp.connectionCount()).toBe(1);
    } finally {
      await automation.close();
      await closeHttpServer(discovery.server);
      if (!firstServerClosed) await closeCdpServer(firstCdp.server);
      await closeCdpServer(secondCdp.server);
    }
  });
});
