import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getReleasePlan, writeReleaseMetadata } from '../../scripts/prepare-release.js';

const commit = 'a'.repeat(40);
const older = 'b'.repeat(40);

function plan(overrides = {}) {
  return getReleasePlan({
    baseVersion: '0.5.0',
    registry: {
      'dist-tags': { latest: '0.3.60' },
      versions: { '0.3.60': { gitHead: older } }
    },
    tags: ['v0.5.0'],
    commit,
    isAncestor: () => true,
    ...overrides
  });
}

describe('automatic release versions', () => {
  it('starts above the existing GitHub release even when npm is behind', () => {
    expect(plan()).toEqual({ version: '0.5.1', shouldPublish: true, distTag: 'latest' });
  });

  it('increments the highest published patch rather than the source baseline', () => {
    expect(
      plan({
        registry: {
          'dist-tags': { latest: '0.5.9' },
          versions: { '0.5.9': { gitHead: older }, '0.5.10': { gitHead: older } }
        }
      }).version
    ).toBe('0.5.11');
  });

  it.each(['0.6.0', '1.0.0'])('honors a deliberate bump to %s', (baseVersion) => {
    expect(plan({ baseVersion }).version).toBe(baseVersion);
  });

  it('uses the baseline for a version line with no existing tag or publication', () => {
    expect(plan({ tags: [] }).version).toBe('0.5.0');
  });

  it('ignores prereleases when advancing the stable version', () => {
    expect(plan({ tags: ['v0.5.0', 'v1.0.0-beta.1'] }).version).toBe('0.5.1');
  });

  it('reuses a publication for the same commit after a partial failure', () => {
    expect(
      plan({
        registry: {
          'dist-tags': { latest: '0.5.1' },
          versions: { '0.5.1': { gitHead: commit } }
        }
      })
    ).toEqual({ version: '0.5.1', shouldPublish: false, distTag: 'latest' });
  });

  it('does not move latest backwards when an older commit finishes CI later', () => {
    expect(plan({ isAncestor: () => false }).distTag).toBe('historical');
  });

  it('stops when ancestry cannot be determined', () => {
    expect(() =>
      plan({
        isAncestor: () => {
          throw new Error('Unknown commit');
        }
      })
    ).toThrow('Unknown commit');
  });

  it.each(['0.5.01', 'v0.5.0', '0.5.0-beta.1'])('rejects baseline %s', (baseVersion) => {
    expect(() => plan({ baseVersion })).toThrow('stable version');
  });

  it('rejects malformed registry data rather than reusing an existing version', () => {
    expect(() => plan({ registry: {} })).toThrow('registry');
  });

  it('rejects an untrusted gitHead before passing it to git', () => {
    expect(() =>
      plan({
        registry: {
          'dist-tags': { latest: '0.5.0' },
          versions: { '0.5.0': { gitHead: '--help' } }
        }
      })
    ).toThrow('source commit');
  });

  it('versions the packed manifest and both lockfile roots without changing dependencies', () => {
    const directory = mkdtempSync(join(tmpdir(), 'weather-release-'));
    const dependencies = { example: '^1.2.3' };
    try {
      writeFileSync(
        join(directory, 'package.json'),
        JSON.stringify({ name: 'weather-cli-16bit', version: '0.5.0', dependencies })
      );
      writeFileSync(
        join(directory, 'package-lock.json'),
        JSON.stringify({
          version: '0.5.0',
          lockfileVersion: 3,
          packages: {
            '': { version: '0.5.0', dependencies },
            'node_modules/example': { version: '1.2.3', integrity: 'unchanged' }
          }
        })
      );
      writeReleaseMetadata(directory, '0.5.1', commit);
      expect(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))).toEqual({
        name: 'weather-cli-16bit',
        version: '0.5.1',
        gitHead: commit,
        dependencies
      });
      expect(JSON.parse(readFileSync(join(directory, 'package-lock.json'), 'utf8'))).toEqual({
        version: '0.5.1',
        lockfileVersion: 3,
        packages: {
          '': { version: '0.5.1', dependencies },
          'node_modules/example': { version: '1.2.3', integrity: 'unchanged' }
        }
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
