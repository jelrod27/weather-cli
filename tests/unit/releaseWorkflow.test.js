import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = 'a'.repeat(40);
const newer = 'b'.repeat(40);
const workflow = readFileSync(
  new URL('../../.github/workflows/npm-publish.yml', import.meta.url),
  'utf8'
);

// Execute the workflow's shell itself; don't duplicate its release decisions.
function runStep(name, env = {}) {
  const step = workflow.split(`- name: ${name}\n`)[1].split(/\n      - name:/)[0];
  const run = step.split('        run: ')[1];
  const script = run.startsWith('|\n')
    ? run
        .slice(2)
        .split('\n')
        .map((line) => line.slice(10))
        .join('\n')
    : run.split('\n')[0];
  const directory = mkdtempSync(join(tmpdir(), 'weather-workflow-'));
  const executable = (name, body) => {
    const path = join(directory, name);
    writeFileSync(path, `#!/bin/bash\nset -euo pipefail\n${body}\n`);
    chmodSync(path, 0o755);
  };
  executable('npm', 'echo "$GITHUB_SHA" > "$CALL_LOG"');
  executable('curl', `printf '{"gitHead":"%s"}\\n' "$LATEST_SHA"`);
  executable('jq', 'cat > /dev/null; echo "$LATEST_SHA"');
  executable(
    'gh',
    `
case "$1 $2" in
  "api repos/jelrod27/weather-cli/git/matching-refs/tags/v0.5.1") echo "$TAG_COUNT" ;;
  "api repos/jelrod27/weather-cli/commits/v0.5.1") echo "$TAG_SHA" ;;
  "api repos/jelrod27/weather-cli/compare/$LATEST_SHA...$SOURCE_SHA") echo "$COMPARE" ;;
  "release view") test "$RELEASE_EXISTS" = true ;;
  "release create") printf '%s\\n' "$@" > "$CALL_LOG" ;;
  *) echo 'Unexpected GitHub call' >&2; exit 2 ;;
esac`
  );
  try {
    const log = join(directory, 'calls');
    writeFileSync(log, '');
    const result = spawnSync('bash', ['-eo', 'pipefail', '-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        CALL_LOG: log,
        GITHUB_SHA: newer,
        SOURCE_SHA: source,
        LATEST_SHA: source,
        GH_REPO: 'jelrod27/weather-cli',
        VERSION: '0.5.1',
        DIST_TAG: 'latest',
        RUNNER_TEMP: directory,
        GITHUB_STEP_SUMMARY: join(directory, 'summary'),
        TAG_COUNT: '0',
        TAG_SHA: source,
        COMPARE: 'identical',
        RELEASE_EXISTS: 'false',
        ...env
      }
    });
    return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe.skipIf(process.platform === 'win32')('release workflow shell', () => {
  it('passes the validated source SHA to npm provenance generation', () => {
    const result = runStep('Publish to npm using trusted publishing');
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toEqual([source]);
  });

  it('marks the current published source as the latest GitHub Release', () => {
    const result = runStep('Create matching GitHub Release');
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toContain('--latest=true');
  });

  it('does not move GitHub latest backwards on a failed-job-only retry', () => {
    const result = runStep('Create matching GitHub Release', {
      LATEST_SHA: newer,
      COMPARE: 'behind'
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toContain('--latest=false');
  });

  it('rejects an existing tag pointing at another commit even without a release', () => {
    const result = runStep('Create matching GitHub Release', {
      TAG_COUNT: '1',
      TAG_SHA: newer
    });
    expect(result.status).not.toBe(0);
    expect(result.calls).toEqual(['']);
  });

  it('leaves an existing release for the correct commit intact', () => {
    const result = runStep('Create matching GitHub Release', {
      TAG_COUNT: '1',
      RELEASE_EXISTS: 'true'
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toEqual(['']);
  });
});
