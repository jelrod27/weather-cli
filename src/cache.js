import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { WeatherError, ERROR_CODES } from './utils/errors.js';

const XDG_CACHE_HOME = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
const CACHE_DIR = join(XDG_CACHE_HOME, 'weather-cli');
const CACHE_FILE = join(CACHE_DIR, 'cache.json');
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of entries
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
// Bump when the cached `data` shape changes. Old entries are discarded on read.
const CACHE_SCHEMA_VERSION = 3;

// Ensure the cache directory exists before any file I/O.
// Called lazily on first read/write so we don't create dirs for mere imports.
let _cacheDirEnsured = false;
async function ensureCacheDir() {
  if (!_cacheDirEnsured) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    _cacheDirEnsured = true;
  }
}

// Load cache from file
async function loadCache() {
  try {
    await ensureCacheDir();
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Atomically save cache to file.
// Writes to a temp file first, then renames (atomic on POSIX) to the target.
// This prevents concurrent processes from reading a half-written file and
// avoids the TOCTOU race where two CLI invocations overwrite each other's data.
async function saveCache(cache) {
  await ensureCacheDir();
  const tmpFile = `${CACHE_FILE}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmpFile, JSON.stringify(cache, null, 2));
    await fs.rename(tmpFile, CACHE_FILE);
  } catch (err) {
    // Clean up the temp file if rename fails
    try {
      await fs.unlink(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
    throw new WeatherError('Failed to save cache', ERROR_CODES.CACHE_ERROR);
  }
}

// Persist cache atomically, merging with the current on-disk state to avoid
// dropping entries written by a concurrent process during our read-modify gap.
// This is the key race-condition fix: instead of replacing the file wholesale
// with our (potentially stale) in-memory copy, we re-read the disk, merge our
// changes in, then write atomically.
async function mergeAndSaveCache(mergeFn) {
  // Re-read the on-disk cache to pick up any writes from concurrent processes
  const diskCache = await loadCache();
  const merged = mergeFn(diskCache);
  await saveCache(merged);
}

// Evict least-recently-used entries if cache is too large.
// Operates on the in-memory cache object (no I/O).
// Uses `lastAccessed` (set on every cache read) so eviction is
// true approximate-LRU that survives across CLI invocations.
function evictOldEntries(cache) {
  const entries = Object.entries(cache);
  const now = Date.now();

  // Remove entries older than the hard max age first
  const fresh = [];
  for (const [key, value] of entries) {
    if (now - value.timestamp < MAX_CACHE_AGE) {
      fresh.push([key, value]);
    }
  }

  // If still too large, evict least-recently-used entries
  if (fresh.length > MAX_CACHE_SIZE) {
    // Sort by lastAccessed ascending — least recently used first
    // If lastAccessed is missing (legacy entries), fall back to timestamp
    fresh.sort((a, b) => {
      const aTime = a[1].lastAccessed ?? a[1].timestamp;
      const bTime = b[1].lastAccessed ?? b[1].timestamp;
      return aTime - bTime;
    });
    return Object.fromEntries(fresh.slice(fresh.length - MAX_CACHE_SIZE));
  }

  return Object.fromEntries(fresh);
}

// Get cached weather data if not expired and schema matches.
// On a cache hit, records the access time so LRU eviction works
// across CLI invocations (not just within one process).
async function getCachedWeather(location, units) {
  const key = `${location}-${units}`;

  // Use merge-and-save so we don't clobber concurrent writes while
  // updating lastAccessed.
  let hitData = null;
  await mergeAndSaveCache((diskCache) => {
    const cached = diskCache[key];
    if (
      cached &&
      cached.schemaVersion === CACHE_SCHEMA_VERSION &&
      Date.now() - cached.timestamp < CACHE_EXPIRY
    ) {
      // Record the access so eviction can sort by recency
      hitData = cached.data;
      diskCache[key] = { ...cached, lastAccessed: Date.now() };
    }
    return diskCache;
  });

  return hitData;
}

// Set cached weather data
// Uses merge-and-save to avoid clobbering concurrent writes.
async function setCachedWeather(location, units, data) {
  const key = `${location}-${units}`;
  const entry = {
    data,
    timestamp: Date.now(),
    lastAccessed: Date.now(),
    schemaVersion: CACHE_SCHEMA_VERSION
  };

  await mergeAndSaveCache((diskCache) => {
    // Merge: apply our new entry on top of the latest disk state
    const merged = { ...diskCache, [key]: entry };
    return evictOldEntries(merged);
  });
}

// Clean expired cache entries
async function cleanExpiredCache() {
  let cleaned = 0;

  await mergeAndSaveCache((diskCache) => {
    const now = Date.now();
    const result = {};
    for (const [key, value] of Object.entries(diskCache)) {
      if (now - value.timestamp >= CACHE_EXPIRY) {
        cleaned++;
      } else {
        result[key] = value;
      }
    }
    return result;
  });

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
  }

  return cleaned;
}

// Get cache statistics
async function getCacheStats() {
  const cache = await loadCache();
  const now = Date.now();
  let total = 0;
  let expired = 0;
  let valid = 0;

  for (const value of Object.values(cache)) {
    total++;
    if (now - value.timestamp >= CACHE_EXPIRY) {
      expired++;
    } else {
      valid++;
    }
  }

  return { total, expired, valid };
}

// Clear all cache (atomic write)
async function clearCache() {
  await saveCache({});
}

// Reset internal state between tests. Not for production use.
function __resetForTesting() {
  _cacheDirEnsured = false;
}

export {
  loadCache,
  saveCache,
  getCachedWeather,
  setCachedWeather,
  cleanExpiredCache,
  getCacheStats,
  clearCache,
  __resetForTesting
};
