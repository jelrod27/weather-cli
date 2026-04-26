import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

// Import after mocking
const { getCachedWeather, setCachedWeather, cleanExpiredCache, getCacheStats, clearCache } =
  await import('../../src/cache.js');

describe('getCachedWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached data when valid and not expired', async () => {
    const cachedData = {
      'London-auto': {
        data: { current: { temp: 20 } },
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        schemaVersion: 2
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
        schemaVersion: 2
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

    await setCachedWeather('London', 'auto', { current: { temp: 20 } });

    expect(fs.writeFile).toHaveBeenCalled();
    const writtenData = JSON.parse(fs.writeFile.mock.calls[0][1]);
    expect(writtenData['London-auto']).toBeDefined();
    expect(writtenData['London-auto'].data).toEqual({ current: { temp: 20 } });
    expect(writtenData['London-auto'].schemaVersion).toBe(2);
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

    const cleaned = await cleanExpiredCache();
    expect(cleaned).toBe(0);
  });
});

describe('clearCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes empty object to cache file', async () => {
    fs.writeFile.mockResolvedValue();

    await clearCache();
    expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), '{}');
  });
});
