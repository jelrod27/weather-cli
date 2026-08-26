import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';

// Mock fs/promises — must include mkdir, rename and unlink for atomic writes
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn()
  }
}));

// Mock crypto.randomUUID so atomic temp-file names are deterministic in tests
vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid'
}));

// Mock config so cache.js's getCacheExpiry() gets a deterministic empty config.
// Without this, loadConfig would try to read the config file via the mocked
// fs/promises and get whatever data the cache test set up for readFile.
vi.mock('../../src/config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({})
}));

// Import after mocking
const cacheModule = await import('../../src/cache.js');
const {
  getCachedWeather,
  setCachedWeather,
  cleanExpiredCache,
  getCacheStats,
  clearCache,
  saveCache,
  loadCache,
  __resetForTesting
} = cacheModule;

// Reset module-level _cacheDirEnsured flag between tests so ensureCacheDir
// re-runs and picks up fresh mock state.
afterEach(() => {
  __resetForTesting();
});

describe('loadCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed cache object when file exists', async () => {
    const cachedData = {
      'London-auto': { data: { temp: 20 }, timestamp: Date.now(), schemaVersion: 3 }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));

    const result = await loadCache();
    expect(result).toEqual(cachedData);
  });

  it('returns empty object when file does not exist', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await loadCache();
    expect(result).toEqual({});
  });

  it('returns empty object for invalid JSON', async () => {
    fs.readFile.mockResolvedValue('not-json');

    const result = await loadCache();
    expect(result).toEqual({});
  });
});

describe('saveCache (atomic write)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes to temp file then renames to target', async () => {
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    const cache = {
      'London-auto': { data: { temp: 20 }, timestamp: Date.now(), schemaVersion: 3 }
    };
    await saveCache(cache);

    // Should write to a temp file first
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      JSON.stringify(cache, null, 2),
      { mode: 0o600 }
    );
    // Then atomically rename to the real cache file
    expect(fs.rename).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.stringContaining('cache.json')
    );
  });

  it('creates the cache directory owner-only', async () => {
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await saveCache({});

    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('weather-cli'),
      expect.objectContaining({ mode: 0o700 })
    );
  });

  it('cleans up temp file if rename fails', async () => {
    fs.writeFile.mockResolvedValue();
    fs.rename.mockRejectedValue(new Error('rename failed'));
    fs.unlink.mockResolvedValue();

    const cache = { test: true };
    await expect(saveCache(cache)).rejects.toThrow('Failed to save cache');

    // Should attempt to clean up the temp file
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
  });
});

describe('getCachedWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getCachedWeather now uses mergeAndSaveCache → saveCache, so mock write ops
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();
  });

  it('returns cached data when valid and not expired', async () => {
    const cachedData = {
      'London-auto': {
        data: { current: { temp: 20 } },
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        schemaVersion: 3
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));

    const result = await getCachedWeather('London', 'auto');
    expect(result).toEqual({ current: { temp: 20 } });
  });

  it('returns null for expired cache entries', async () => {
    const cachedData = {
      'London-auto': {
        data: { current: { temp: 20 } },
        timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago (expired)
        schemaVersion: 3
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));

    const result = await getCachedWeather('London', 'auto');
    expect(result).toBeNull();
  });

  it('returns null for entries from an older schema version', async () => {
    const cachedData = {
      'London-auto': {
        data: { current: { temp: 20 } },
        timestamp: Date.now() - 5 * 60 * 1000
        // no schemaVersion → pre-0.4 entry from OWM era
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));

    const result = await getCachedWeather('London', 'auto');
    expect(result).toBeNull();
  });

  it('returns null when no cache entry exists', async () => {
    fs.readFile.mockResolvedValue('{}');

    const result = await getCachedWeather('Unknown', 'auto');
    expect(result).toBeNull();
  });

  it('returns null when cache file does not exist', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await getCachedWeather('London', 'auto');
    expect(result).toBeNull();
  });
});

describe('setCachedWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes cache data to file with current schema version', async () => {
    fs.readFile.mockResolvedValue('{}');
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await setCachedWeather('London', 'auto', { current: { temp: 20 } });

    // Atomic write: writeFile to temp, then rename
    expect(fs.writeFile).toHaveBeenCalled();
    expect(fs.rename).toHaveBeenCalled();

    // The final written content should contain our entry
    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed['London-auto']).toBeDefined();
    expect(parsed['London-auto'].data).toEqual({ current: { temp: 20 } });
    expect(parsed['London-auto'].schemaVersion).toBe(3);
  });

  it('merges with on-disk cache rather than replacing it', async () => {
    // Simulate a concurrent process having written a Paris entry to disk
    const diskCache = {
      'Paris-auto': {
        data: { current: { temp: 18 } },
        timestamp: Date.now(),
        schemaVersion: 3
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(diskCache));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await setCachedWeather('London', 'auto', { current: { temp: 20 } });

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    // Both entries should be present — Paris wasn't clobbered
    expect(parsed['Paris-auto']).toBeDefined();
    expect(parsed['London-auto']).toBeDefined();
  });

  it('evicts entries when cache exceeds max size', async () => {
    // Create a cache at capacity with old timestamps
    const fullCache = {};
    for (let i = 0; i < 100; i++) {
      fullCache[`City${i}-auto`] = {
        data: { temp: i },
        timestamp: Date.now() - i * 1000, // staggered timestamps
        schemaVersion: 3
      };
    }
    fs.readFile.mockResolvedValue(JSON.stringify(fullCache));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await setCachedWeather('NewCity', 'auto', { temp: 99 });

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    // Should not exceed MAX_CACHE_SIZE entries
    expect(Object.keys(parsed).length).toBeLessThanOrEqual(100);
  });
});

describe('getCacheStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct stats for mixed cache', async () => {
    const cachedData = {
      'London-auto': {
        data: {},
        timestamp: Date.now() - 5 * 60 * 1000 // valid
      },
      'Paris-auto': {
        data: {},
        timestamp: Date.now() - 60 * 60 * 1000 // expired
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));

    const stats = await getCacheStats();
    expect(stats.total).toBe(2);
    expect(stats.valid).toBe(1);
    expect(stats.expired).toBe(1);
  });

  it('returns zeros for empty cache', async () => {
    fs.readFile.mockResolvedValue('{}');

    const stats = await getCacheStats();
    expect(stats).toEqual({ total: 0, valid: 0, expired: 0 });
  });
});

describe('cleanExpiredCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes expired entries and returns count', async () => {
    const cachedData = {
      'London-auto': {
        data: {},
        timestamp: Date.now() - 5 * 60 * 1000 // valid
      },
      'Paris-auto': {
        data: {},
        timestamp: Date.now() - 60 * 60 * 1000 // expired
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    const cleaned = await cleanExpiredCache();
    expect(cleaned).toBe(1);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('returns 0 when nothing to clean', async () => {
    const cachedData = {
      'London-auto': {
        data: {},
        timestamp: Date.now() - 5 * 60 * 1000 // valid
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    const cleaned = await cleanExpiredCache();
    expect(cleaned).toBe(0);
  });
});

describe('clearCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomically writes empty object to cache file', async () => {
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await clearCache();

    // Should write '{}' to a temp file, then rename
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('.tmp'), '{}', {
      mode: 0o600
    });
    expect(fs.rename).toHaveBeenCalled();
  });
});

describe('LRU eviction across invocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();
  });

  it('evicts least-recently-accessed entries when over capacity', async () => {
    // Create 100 entries with staggered lastAccessed times.
    // City0 has oldest lastAccessed, City99 has newest.
    const now = Date.now();
    const fullCache = {};
    for (let i = 0; i < 100; i++) {
      fullCache[`City${i}-auto`] = {
        data: { temp: i },
        timestamp: now - (100 - i) * 60 * 1000,
        lastAccessed: now - (100 - i) * 60 * 1000,
        schemaVersion: 3
      };
    }
    fs.readFile.mockResolvedValue(JSON.stringify(fullCache));

    // Adding a 101st entry should trigger eviction of City0 (oldest lastAccessed)
    await setCachedWeather('NewCity', 'auto', { temp: 99 });

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);

    // City0 (oldest lastAccessed) should be evicted, City1-City99 + NewCity remain
    expect(Object.keys(parsed).length).toBeLessThanOrEqual(100);
    expect(parsed['City0-auto']).toBeUndefined();
    expect(parsed['NewCity-auto']).toBeDefined();
    expect(parsed['City99-auto']).toBeDefined();
  });

  it('prefers lastAccessed over timestamp for eviction order', async () => {
    const now = Date.now();
    const fullCache = {};

    // City0 was inserted first (old timestamp) but accessed recently (new lastAccessed)
    fullCache['City0-auto'] = {
      data: { temp: 0 },
      timestamp: now - 200 * 60 * 1000, // inserted 200 min ago
      lastAccessed: now - 1 * 60 * 1000, // accessed 1 min ago
      schemaVersion: 3
    };

    // City1 was inserted recently (new timestamp) but never re-accessed
    fullCache['City1-auto'] = {
      data: { temp: 1 },
      timestamp: now - 2 * 60 * 1000, // inserted 2 min ago
      lastAccessed: now - 2 * 60 * 1000, // accessed = insertion time (never re-hit)
      schemaVersion: 3
    };

    // Fill up to 100 more entries
    for (let i = 2; i < 100; i++) {
      fullCache[`City${i}-auto`] = {
        data: { temp: i },
        timestamp: now - (100 - i) * 60 * 1000,
        lastAccessed: now - 5 * 60 * 1000, // accessed 5 min ago
        schemaVersion: 3
      };
    }
    fs.readFile.mockResolvedValue(JSON.stringify(fullCache));

    await setCachedWeather('NewCity', 'auto', { temp: 99 });

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);

    // City1 (lastAccessed 2 min ago, never re-hit) should be evicted before City0
    // (lastAccessed 1 min ago, recently used) because City0 has a more recent lastAccessed
    expect(parsed['City0-auto']).toBeDefined();
    expect(parsed['NewCity-auto']).toBeDefined();
  });

  it('falls back to timestamp when lastAccessed is missing (legacy entries)', async () => {
    const now = Date.now();
    const fullCache = {};

    // Legacy entry without lastAccessed — eviction should use timestamp
    fullCache['Old-city-auto'] = {
      data: { temp: 0 },
      timestamp: now - 1000 * 60 * 60 * 24 * 6, // 6 days old
      schemaVersion: 3
      // No lastAccessed — legacy entry
    };

    for (let i = 1; i < 100; i++) {
      fullCache[`City${i}-auto`] = {
        data: { temp: i },
        timestamp: now - i * 60 * 1000,
        lastAccessed: now - i * 60 * 1000,
        schemaVersion: 3
      };
    }
    fs.readFile.mockResolvedValue(JSON.stringify(fullCache));

    await setCachedWeather('NewCity', 'auto', { temp: 99 });

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);

    // The old legacy entry should be evicted (its fallback timestamp is 6 days old)
    expect(parsed['Old-city-auto']).toBeUndefined();
    expect(parsed['NewCity-auto']).toBeDefined();
  });

  it('getCachedWeather records lastAccessed on cache hit when stale', async () => {
    const now = Date.now();
    const cachedData = {
      'London-auto': {
        data: { current: { temp: 20 } },
        timestamp: now - 10 * 60 * 1000,
        lastAccessed: now - 10 * 60 * 1000, // 10 min ago — past the 5-min threshold
        schemaVersion: 3
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    const before = Date.now();
    const result = await getCachedWeather('London', 'auto');

    expect(result).toEqual({ current: { temp: 20 } });

    // The merge-and-save should have written back with updated lastAccessed
    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed['London-auto'].lastAccessed).toBeGreaterThanOrEqual(before);
  });

  it('getCachedWeather skips lastAccessed write when recently accessed', async () => {
    const now = Date.now();
    const cachedData = {
      'London-auto': {
        data: { current: { temp: 20 } },
        timestamp: now - 10 * 60 * 1000,
        lastAccessed: now - 1 * 60 * 1000, // 1 min ago — within the 5-min threshold
        schemaVersion: 3
      }
    };
    fs.readFile.mockResolvedValue(JSON.stringify(cachedData));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    const result = await getCachedWeather('London', 'auto');

    expect(result).toEqual({ current: { temp: 20 } });

    // No write should occur when access is within threshold
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('getCachedWeather does not update lastAccessed on miss', async () => {
    fs.readFile.mockResolvedValue('{}');
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    const result = await getCachedWeather('Unknown', 'auto');
    expect(result).toBeNull();

    // No write should occur on a cache miss
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});

describe('race condition safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setCachedWeather does not clobber entries added by concurrent processes', async () => {
    // Simulate a cache file that already has a concurrent write (Paris).
    // setCachedWeather calls mergeAndSaveCache which re-reads disk then merges,
    // so the Paris entry survives alongside the new London entry.
    const concurrentCache = {
      'Paris-auto': {
        data: { current: { temp: 18 } },
        timestamp: Date.now(),
        schemaVersion: 3
      }
    };

    fs.readFile.mockResolvedValue(JSON.stringify(concurrentCache));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await setCachedWeather('London', 'auto', { current: { temp: 20 } });

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);

    // Both the new entry and the concurrent write should be preserved
    expect(parsed['London-auto']).toBeDefined();
    expect(parsed['Paris-auto']).toBeDefined();
  });
});
