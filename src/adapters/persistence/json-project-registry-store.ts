import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import type {
  ProjectRegistryStore,
  RegistryConfig,
} from '../../application/project-registry';
import { logger } from '../../shared/logger';

const registryConfigSchema = z.object({
  portRange: z
    .tuple([z.number().int().min(1).max(65_535), z.number().int().min(1).max(65_535)])
    .refine(([start, end]) => start <= end, 'Port range start must not exceed its end.'),
  projects: z.record(
    z.string().min(1),
    z.object({
      port: z.number().int().min(1).max(65_535),
      windowTitlePattern: z.string().min(1).optional(),
    }),
  ),
});

const CONFIG_FILENAME = '.debug-electron-mcp.json';

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export class JsonProjectRegistryStore implements ProjectRegistryStore {
  constructor(
    private readonly configPath = path.join(os.homedir(), CONFIG_FILENAME),
  ) {}

  load(): RegistryConfig | undefined {
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      const parsed: unknown = JSON.parse(data);
      return registryConfigSchema.parse(parsed);
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw new Error(`Failed to load registry at ${this.configPath}`, { cause: error });
    }
  }

  save(config: RegistryConfig): void {
    const temporaryPath = `${this.configPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), {
        encoding: 'utf8',
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
      throw new Error(`Failed to save registry at ${this.configPath}`, { cause: error });
    }
  }
}
