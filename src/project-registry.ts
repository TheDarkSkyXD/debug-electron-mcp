import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './utils/logger';

export interface ProjectConfig {
  port: number;
  windowTitlePattern?: string;
}

export interface RegistryConfig {
  portRange: [number, number];
  projects: Record<string, ProjectConfig>;
}

const DEFAULT_PORT_RANGE: [number, number] = [9222, 9322];
const CONFIG_FILENAME = '.debug-electron-mcp.json';

class ProjectRegistry {
  private config: RegistryConfig;
  private configPath: string;
  private static instance: ProjectRegistry;

  private constructor() {
    this.configPath = path.join(os.homedir(), CONFIG_FILENAME);
    this.config = {
      portRange: DEFAULT_PORT_RANGE,
      projects: {},
    };
    this.load();
  }

  static getInstance(): ProjectRegistry {
    if (!ProjectRegistry.instance) {
      ProjectRegistry.instance = new ProjectRegistry();
    }
    return ProjectRegistry.instance;
  }

  register(name: string, port?: number, windowTitlePattern?: string): ProjectConfig {
    if (this.config.projects[name]) {
      const existing = this.config.projects[name];
      // Update windowTitlePattern if provided
      if (windowTitlePattern !== undefined) {
        existing.windowTitlePattern = windowTitlePattern;
        this.save();
      }
      return existing;
    }

    const assignedPort = port ?? this.getNextFreePort();
    const projectConfig: ProjectConfig = { port: assignedPort };
    if (windowTitlePattern) {
      projectConfig.windowTitlePattern = windowTitlePattern;
    }

    this.config.projects[name] = projectConfig;
    this.save();
    return projectConfig;
  }

  unregister(name: string): boolean {
    if (!this.config.projects[name]) {
      return false;
    }
    delete this.config.projects[name];
    this.save();
    return true;
  }

  resolve(name: string): ProjectConfig | undefined {
    return this.config.projects[name];
  }

  list(): Record<string, ProjectConfig> {
    return { ...this.config.projects };
  }

  getNextFreePort(): number {
    const [rangeStart, rangeEnd] = this.config.portRange;
    const usedPorts = new Set(Object.values(this.config.projects).map((p) => p.port));

    for (let port = rangeStart; port <= rangeEnd; port++) {
      if (!usedPorts.has(port)) {
        return port;
      }
    }

    throw new Error(
      `No free ports available in range ${rangeStart}-${rangeEnd}. Unregister unused projects first.`,
    );
  }

  save(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.debug(`Registry saved to ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save registry:`, error);
    }
  }

  load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed.portRange) {
          this.config.portRange = parsed.portRange;
        }
        if (parsed.projects) {
          this.config.projects = parsed.projects;
        }
        logger.debug(`Registry loaded from ${this.configPath}`);
      }
    } catch (error) {
      logger.debug(`No existing registry found or failed to load:`, error);
    }
  }
}

export const projectRegistry = ProjectRegistry.getInstance();
