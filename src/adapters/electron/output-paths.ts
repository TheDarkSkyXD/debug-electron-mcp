import * as os from 'os';
import * as path from 'path';

/**
 * Locations tool output must never be written to, even with no allowlist
 * configured. A screenshot or trace is attacker-influenced data, so an
 * unconstrained path would let a prompt-injected agent drop a file into a
 * directory the user never meant to touch.
 *
 * Matched as directory prefixes (resolved + separator) so blocking `/etc`
 * rejects `/etc/cron.d/payload` too. `~` is expanded per platform.
 */
function blockedRoots(): readonly string[] {
  const home = os.homedir();
  // Credentials live here on every platform, so it is blocked everywhere.
  const universal = [path.join(home, '.ssh'), path.join(home, '.aws')];
  const posix = ['/etc', '/proc', '/sys', '/usr', '/bin', '/sbin', '/boot', '/dev'];
  const win32 = ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData'];
  return process.platform === 'win32' ? [...universal, ...win32] : [...universal, ...posix];
}

function isInside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function readRoots(variable: string): readonly string[] {
  const raw = process.env[variable]?.trim();
  if (!raw) return [];
  return raw
    .split(/[;|]/)
    .map((entry) => path.resolve(entry.trim()))
    .filter((entry) => entry.length > 0);
}

/**
 * Resolve a tool output path, rejecting anything that must not be written.
 *
 * Two independent gates, because they defend against different things. The
 * blocklist stops writes to sensitive system locations on an unconfigured
 * server. The allowlist, when the operator sets one, makes it the only set of
 * legal destinations.
 *
 * @param requestedPath Caller-supplied path, absolute or relative.
 * @param allowlistVariable Environment variable naming the permitted roots.
 * @returns The resolved absolute path, safe to write.
 * @throws When the path is blocked or outside the configured allowlist.
 */
export function resolveOutputPath(requestedPath: string, allowlistVariable: string): string {
  const resolved = path.resolve(requestedPath);

  const blocked = blockedRoots().find((root) => isInside(resolved, root));
  if (blocked) {
    throw new Error(
      `Refusing to write to a sensitive location: ${resolved} (matches blocked root ${blocked}).`,
    );
  }

  const allowed = readRoots(allowlistVariable);
  if (allowed.length > 0 && !allowed.some((root) => isInside(resolved, root))) {
    throw new Error(
      `Output path ${resolved} is outside ${allowlistVariable} (${allowed.join(', ')}).`,
    );
  }

  return resolved;
}
