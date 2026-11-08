import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe.skipIf(process.platform === 'win32')('existing storage permissions on POSIX', () => {
  let storageRoot;

  beforeEach(async () => {
    storageRoot = await fs.mkdtemp(join(tmpdir(), 'weather-cli-permissions-'));
    vi.stubEnv('XDG_CACHE_HOME', join(storageRoot, 'cache'));
    vi.stubEnv('XDG_CONFIG_HOME', join(storageRoot, 'config'));
    vi.resetModules();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await fs.rm(storageRoot, { recursive: true, force: true });
  });

  it.each([
    ['cache', 'cache.json', '../../src/cache.js', 'loadCache'],
    ['config', 'config.json', '../../src/config.js', 'loadConfig']
  ])('tightens an existing %s directory and file on read', async (kind, file, modulePath, load) => {
    const parent = join(storageRoot, kind);
    const directory = join(parent, 'weather-cli');
    const filename = join(directory, file);
    await fs.mkdir(directory, { recursive: true });
    await fs.chmod(parent, 0o755);
    await fs.chmod(directory, 0o755);
    await fs.writeFile(filename, JSON.stringify({ location: 'London' }));
    await fs.chmod(filename, 0o644);

    const storage = await import(modulePath);
    const readFile = fs.readFile.bind(fs);
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args) => {
      if (args[0] === filename) {
        expect((await fs.stat(directory)).mode & 0o777).toBe(0o700);
        expect((await fs.stat(filename)).mode & 0o777).toBe(0o600);
      }
      return readFile(...args);
    });
    expect(await storage[load]()).toEqual({ location: 'London' });

    expect((await fs.stat(directory)).mode & 0o777).toBe(0o700);
    expect((await fs.stat(filename)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(parent)).mode & 0o777).toBe(0o755);
  });

  it.each([
    ['cache', '../../src/cache.js', 'loadCache'],
    ['config', '../../src/config.js', 'loadConfig']
  ])('returns empty %s on first run', async (kind, modulePath, load) => {
    const storage = await import(modulePath);

    expect(await storage[load]()).toEqual({});
    expect((await fs.stat(join(storageRoot, kind, 'weather-cli'))).mode & 0o777).toBe(0o700);
  });
});
