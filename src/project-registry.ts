import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'node:crypto';
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

export class ProjectRegistry {
  private config: RegistryConfig;
  private readonly configPath: string;
  private static instance: ProjectRegistry | undefined;

  constructor(configPath = path.join(os.homedir(), CONFIG_FILENAME)) {
    this.configPath = configPath;
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
      if (windowTitlePattern === undefined) return { ...existing };

      const updated = { ...existing, windowTitlePattern };
      this.persist({
        ...this.config,
        projects: { ...this.config.projects, [name]: updated },
      });
      return { ...updated };
    }

    const assignedPort = port ?? this.getNextFreePort();
    const projectConfig: ProjectConfig = { port: assignedPort };
    if (windowTitlePattern !== undefined) {
      projectConfig.windowTitlePattern = windowTitlePattern;
    }

    this.persist({
      ...this.config,
      projects: { ...this.config.projects, [name]: projectConfig },
    });
    return { ...projectConfig };
  }

  unregister(name: string): boolean {
    if (!this.config.projects[name]) {
      return false;
    }
    const projects = { ...this.config.projects };
    delete projects[name];
    this.persist({ ...this.config, projects });
    return true;
  }

  resolve(name: string): ProjectConfig | undefined {
    const project = this.config.projects[name];
    return project ? { ...project } : undefined;
  }

  list(): Record<string, ProjectConfig> {
    return Object.fromEntries(
      Object.entries(this.config.projects).map(([name, project]) => [name, { ...project }]),
    );
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

  private persist(nextConfig: RegistryConfig): void {
    this.writeAtomic(nextConfig);
    this.config = nextConfig;
  }

  private writeAtomic(config: RegistryConfig): void {
    const temporaryPath = `${this.configPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), {
        encoding: 'utf-8',
        flag: 'wx',
      });
      fs.renameSync(temporaryPath, this.configPath);
      logger.debug(`Registry saved to ${this.configPath}`);
    } catch (error) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {
        // The temporary file may not exist or may already have been renamed.
      }
      logger.error(`Failed to save registry:`, error);
      throw new Error(`Failed to save registry at ${this.configPath}`, { cause: error });
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
