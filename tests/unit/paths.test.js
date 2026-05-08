import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { getConfigFile, getCacheFile } from '../../src/utils/paths.js';

const ENV_KEYS = ['XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'APPDATA', 'LOCALAPPDATA'];

describe('paths', () => {
  let saved;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('config file lives under the config dir, not the install dir', () => {
    const file = getConfigFile();
    expect(file).toContain('weather-cli');
    expect(file.endsWith('config.json')).toBe(true);
    expect(file).not.toMatch(/node_modules/);
    if (process.platform !== 'win32') {
      expect(file.startsWith(path.join(os.homedir(), '.config'))).toBe(true);
    }
  });

  it('cache file lives under the cache dir, not the install dir', () => {
    const file = getCacheFile();
    expect(file).toContain('weather-cli');
    expect(file.endsWith('cache.json')).toBe(true);
    expect(file).not.toMatch(/node_modules/);
    if (process.platform !== 'win32') {
      expect(file.startsWith(path.join(os.homedir(), '.cache'))).toBe(true);
    }
  });

  it('honors XDG_CONFIG_HOME when set (POSIX)', () => {
    if (process.platform === 'win32') return;
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(getConfigFile()).toBe('/tmp/xdg-config/weather-cli/config.json');
  });

  it('honors XDG_CACHE_HOME when set (POSIX)', () => {
    if (process.platform === 'win32') return;
    process.env.XDG_CACHE_HOME = '/tmp/xdg-cache';
    expect(getCacheFile()).toBe('/tmp/xdg-cache/weather-cli/cache.json');
  });
});
