import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const sourceCommit = /^[a-f0-9]{40}$/;

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function getReleasePlan({ baseVersion, registry, tags, commit, isAncestor }) {
  if (!stableVersion.test(baseVersion)) {
    throw new Error('package.json must contain a stable version without leading zeros');
  }
  const latest = registry?.versions?.[registry?.['dist-tags']?.latest];
  if (!latest || typeof registry.versions !== 'object') {
    throw new Error('Invalid npm registry metadata: latest version is missing');
  }
  if (!sourceCommit.test(commit) || !sourceCommit.test(latest.gitHead)) {
    throw new Error('Cannot determine the source commit of the latest npm release');
  }

  const distTag = isAncestor(latest.gitHead, commit) ? 'latest' : 'historical';
  const versions = Object.keys(registry.versions).filter((v) => stableVersion.test(v));
  const existing = versions
    .filter((v) => registry.versions[v].gitHead === commit)
    .sort(compareVersions)
    .at(-1);
  if (existing) return { version: existing, shouldPublish: false, distTag };

  const highest = [...versions, ...tags.filter((t) => t.startsWith('v')).map((t) => t.slice(1))]
    .filter((v) => stableVersion.test(v))
    .sort(compareVersions)
    .at(-1);
  let version = baseVersion;
  if (highest && compareVersions(baseVersion, highest) <= 0) {
    const [major, minor, patch] = highest.split('.').map(Number);
    if (!Number.isSafeInteger(patch + 1))
      throw new Error('Patch version exceeds safe integer range');
    version = `${major}.${minor}.${patch + 1}`;
  }
  return { version, shouldPublish: true, distTag };
}

export function writeReleaseMetadata(directory, version, commit) {
  const packagePath = resolve(directory, 'package.json');
  const lockPath = resolve(directory, 'package-lock.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  pkg.version = version;
  // npm publish of a tarball has no checkout from which to infer gitHead.
  pkg.gitHead = commit;
  lock.version = version;
  lock.packages[''].version = version;
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

async function main() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const commit = git('rev-parse', 'HEAD');
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, {
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
  const plan = getReleasePlan({
    baseVersion: pkg.version,
    registry: await response.json(),
    tags: git('tag', '--list', 'v*').split('\n'),
    commit,
    isAncestor: (ancestor, descendant) => {
      try {
        git('merge-base', '--is-ancestor', ancestor, descendant);
        return true;
      } catch (error) {
        if (error.status === 1) return false;
        throw error;
      }
    }
  });
  console.log(JSON.stringify({ ...plan, commit }, null, 2));
  if (process.argv.includes('--write')) {
    if (!process.env.GITHUB_OUTPUT) throw new Error('--write requires GITHUB_OUTPUT');
    if (plan.shouldPublish) writeReleaseMetadata(process.cwd(), plan.version, commit);
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${plan.version}\nshould_publish=${plan.shouldPublish}\ndist_tag=${plan.distTag}\n`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
