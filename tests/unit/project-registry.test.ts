import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonProjectRegistryStore } from '../../src/adapters/persistence/json-project-registry-store';
import { ProjectRegistry } from '../../src/application/project-registry';

describe('ProjectRegistry persistence', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function temporaryDirectory(): string {
    const directory = mkdtempSync(join(tmpdir(), 'debug-electron-registry-'));
    temporaryDirectories.push(directory);
    return directory;
  }

  it('atomically persists a complete registry without leaving temporary files', () => {
    const directory = temporaryDirectory();
    const configPath = join(directory, 'registry.json');
    const registry = new ProjectRegistry(new JsonProjectRegistryStore(configPath));

    registry.register('app', 9222, 'Application');
    registry.register('app', undefined, 'Updated Application');

    expect(JSON.parse(readFileSync(configPath, 'utf8'))).toMatchObject({
      projects: { app: { port: 9222, windowTitlePattern: 'Updated Application' } },
    });
    expect(readdirSync(directory)).toEqual(['registry.json']);
  });

  it('propagates persistence failures without publishing an in-memory registration', () => {
    const directory = temporaryDirectory();
    const configPath = join(directory, 'missing', 'registry.json');
    const registry = new ProjectRegistry(new JsonProjectRegistryStore(configPath));

    expect(() => registry.register('app', 9222)).toThrow();
    expect(registry.resolve('app')).toBeUndefined();
  });

  it('rejects malformed persisted configuration at the filesystem boundary', () => {
    const directory = temporaryDirectory();
    const configPath = join(directory, 'registry.json');
    writeFileSync(configPath, JSON.stringify({ projects: { app: { port: 'invalid' } } }));

    expect(() => new JsonProjectRegistryStore(configPath).load()).toThrow(
      `Failed to load registry at ${configPath}`,
    );
  });
});
