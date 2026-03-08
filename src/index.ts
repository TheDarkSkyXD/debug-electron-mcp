#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { createMcpServer } from './create-server';
import { projectRegistry } from './project-registry';
import { logger } from './utils/logger';
import { tools } from './tools';

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let project: string | undefined;
  let mode: 'stdio' | 'serve' = 'stdio';
  let httpPort = 3100;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === 'serve') {
      mode = 'serve';
    } else if (args[i] === '--project' && i + 1 < args.length) {
      project = args[++i];
    } else if (args[i] === '--port' && i + 1 < args.length) {
      httpPort = parseInt(args[++i], 10);
    }
  }

  return { project, mode, httpPort };
}

/**
 * Auto-detect the project name from the working directory.
 * Reads package.json name, or falls back to the directory name.
 * Returns undefined only if cwd is a root/home directory.
 */
function detectProjectName(): string | undefined {
  const cwd = process.cwd();

  // Don't auto-detect from home or root directories
  const home = require('os').homedir();
  if (cwd === home || cwd === '/' || cwd === path.parse(cwd).root) {
    return undefined;
  }

  // Try package.json name
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) {
        // Strip npm scope (e.g. @org/app-name -> app-name)
        return pkg.name.replace(/^@[^/]+\//, '');
      }
    }
  } catch {
    // ignore
  }

  // Fall back to directory name
  return path.basename(cwd);
}

/**
 * Ensure a project is registered and return its name.
 * If already registered, returns existing config.
 * If not, auto-registers with next free port.
 */
function ensureProjectRegistered(name: string): { name: string; port: number; isNew: boolean } {
  const existing = projectRegistry.resolve(name);
  if (existing) {
    return { name, port: existing.port, isNew: false };
  }

  const config = projectRegistry.register(name);
  return { name, port: config.port, isNew: true };
}

const { project, mode, httpPort } = parseArgs(process.argv);

if (mode === 'serve') {
  import('./serve').then(({ startHttpServer }) => {
    startHttpServer(httpPort).catch((error) => {
      logger.error('HTTP server error:', error);
      process.exit(1);
    });
  });
} else {
  // Determine project name: explicit --project flag > auto-detect from cwd
  let projectName = project;

  if (!projectName) {
    const detected = detectProjectName();
    if (detected) {
      projectName = detected;
      logger.info(`Auto-detected project: ${detected}`);
    }
  }

  // Auto-register the project if we have a name
  if (projectName) {
    const result = ensureProjectRegistered(projectName);
    if (result.isNew) {
      logger.info(
        `Project "${result.name}" auto-registered on port ${result.port}. ` +
        `Start your Electron app with: electron . --remote-debugging-port=${result.port}`,
      );
    } else {
      logger.info(`Project "${result.name}" using port ${result.port}`);
    }
  }

  const server = createMcpServer(projectName);

  async function main() {
    const transport = new StdioServerTransport();
    logger.info('Electron MCP Server starting...');
    await server.connect(transport);
    logger.info('Electron MCP Server running on stdio');
    logger.info('Available tools:', tools.map((t) => t.name).join(', '));
  }

  main().catch((error) => {
    logger.error('Server error:', error);
    process.exit(1);
  });
}
