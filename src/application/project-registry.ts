export interface ProjectConfig {
  readonly port: number;
  readonly windowTitlePattern?: string;
}

export interface RegistryConfig {
  readonly portRange: readonly [number, number];
  readonly projects: Readonly<Record<string, ProjectConfig>>;
}

export interface ProjectRegistryStore {
  load(): RegistryConfig | undefined;
  save(config: RegistryConfig): void;
}

const DEFAULT_PORT_RANGE = [9222, 9322] as const;

export class ProjectRegistry {
  private config: RegistryConfig;

  constructor(private readonly store: ProjectRegistryStore) {
    this.config = store.load() ?? { portRange: DEFAULT_PORT_RANGE, projects: {} };
  }

  register(name: string, port?: number, windowTitlePattern?: string): ProjectConfig {
    const existing = this.config.projects[name];
    if (existing) {
      if (windowTitlePattern === undefined) return { ...existing };

      const updated = { ...existing, windowTitlePattern };
      this.persist({
        ...this.config,
        projects: { ...this.config.projects, [name]: updated },
      });
      return { ...updated };
    }

    const projectConfig: ProjectConfig = {
      port: port ?? this.getNextFreePort(),
      ...(windowTitlePattern === undefined ? {} : { windowTitlePattern }),
    };
    this.persist({
      ...this.config,
      projects: { ...this.config.projects, [name]: projectConfig },
    });
    return { ...projectConfig };
  }

  unregister(name: string): boolean {
    if (!this.config.projects[name]) return false;

    const projects = { ...this.config.projects };
    delete projects[name];
    this.persist({ ...this.config, projects });
    return true;
  }

  resolve(name: string): ProjectConfig | undefined {
    const project = this.config.projects[name];
    return project ? { ...project } : undefined;
  }

  list(): Readonly<Record<string, ProjectConfig>> {
    return Object.fromEntries(
      Object.entries(this.config.projects).map(([name, project]) => [name, { ...project }]),
    );
  }

  getNextFreePort(): number {
    const [rangeStart, rangeEnd] = this.config.portRange;
    const usedPorts = new Set(Object.values(this.config.projects).map((project) => project.port));

    for (let port = rangeStart; port <= rangeEnd; port += 1) {
      if (!usedPorts.has(port)) return port;
    }

    throw new Error(
      `No free ports available in range ${rangeStart}-${rangeEnd}. Unregister unused projects first.`,
    );
  }

  private persist(nextConfig: RegistryConfig): void {
    this.store.save(nextConfig);
    this.config = nextConfig;
  }
}
