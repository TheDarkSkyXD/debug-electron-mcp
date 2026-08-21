import { readFile } from 'node:fs/promises';

const minimumAgeDays = 7;
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lockfile = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
const now = Date.now();
const minimumAgeMs = minimumAgeDays * 24 * 60 * 60 * 1000;
const metadataCache = new Map();
const checkAllLockfileEntries = process.argv.includes('--all');

function lockfilePackageName(packagePath) {
  const marker = 'node_modules/';
  const start = packagePath.lastIndexOf(marker);
  if (start === -1) return undefined;
  const segments = packagePath.slice(start + marker.length).split('/');
  return segments[0]?.startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0];
}

async function packageMetadata(name) {
  const cached = metadataCache.get(name);
  if (cached) return cached;
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Could not read npm metadata for ${name}.`);
  const metadata = await response.json();
  metadataCache.set(name, metadata);
  return metadata;
}

async function mapBounded(items, mapper, concurrency = 8) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const packageEntries = Object.entries(lockfile.packages ?? {})
  .map(([packagePath, packageInfo]) => ({
    packagePath,
    name: packageInfo?.name ?? lockfilePackageName(packagePath),
    version: packageInfo?.version,
  }))
  .filter((entry) => entry.name && typeof entry.version === 'string');

for (const name of Object.keys(dependencies)) {
  if (!packageEntries.some((entry) => entry.packagePath === `node_modules/${name}`)) {
    throw new Error(`Lockfile has no resolved version for ${name}.`);
  }
}

const directPackageEntries = packageEntries.filter(
  (entry) => Object.hasOwn(dependencies, entry.name) && entry.packagePath === `node_modules/${entry.name}`,
);
const checkedEntries = checkAllLockfileEntries ? packageEntries : directPackageEntries;

const results = await mapBounded(checkedEntries, async (entry) => {
  const metadata = await packageMetadata(entry.name);
  const publishedAt = new Date(metadata.time?.[entry.version]);
  if (Number.isNaN(publishedAt.valueOf())) {
    throw new Error(`No publish time exists for ${entry.name}@${entry.version}.`);
  }
  const ageMs = now - publishedAt.valueOf();
  return { ...entry, ageMs, ageDays: ageMs / (24 * 60 * 60 * 1000) };
});

const directResults = results
  .filter((entry) => Object.hasOwn(dependencies, entry.name))
  .sort((left, right) => left.name.localeCompare(right.name));

for (const entry of directResults) {
  console.log(`${entry.name}\t${entry.version}\t${entry.ageDays.toFixed(1)} days\tdeclared ${dependencies[entry.name]}`);
}

console.log(
  `checked ${results.length} ${checkAllLockfileEntries ? 'lockfile package entries' : 'direct dependency entries'}; ` +
    `${directResults.length} direct dependencies; minimum age ${minimumAgeDays} days`,
);
if (!checkAllLockfileEntries) {
  console.log('transitive dependency freshness is handled by npm audit; pass --all to inspect every lockfile entry');
}

const failures = results
  .filter((entry) => entry.ageMs < minimumAgeMs)
  .map((entry) => `${entry.name}@${entry.version} at ${entry.packagePath} is ${entry.ageDays.toFixed(1)} days old`);

if (failures.length > 0) throw new Error(`Dependency maturity gate failed. ${failures.join('; ')}`);
