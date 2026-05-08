import fs from 'fs/promises';
import { ensureParentDir, getCacheFile } from './utils/paths.js';
import { WeatherError, ERROR_CODES } from './utils/errors.js';

const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of entries
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Simple LRU tracking
const accessOrder = [];

// Load cache from file
async function loadCache() {
  try {
    const data = await fs.readFile(getCacheFile(), 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save cache to file
async function saveCache(cache) {
  const file = getCacheFile();
  try {
    await ensureParentDir(file);
    await fs.writeFile(file, JSON.stringify(cache, null, 2));
  } catch (error) {
    throw new WeatherError('Failed to save cache', ERROR_CODES.CACHE_ERROR);
  }
}

// Evict oldest entries if cache is too large
async function evictOldEntries(cache) {
  const entries = Object.entries(cache);
  const now = Date.now();

  // Remove very old entries first
  let updatedCache = {};
  let count = 0;

  for (const [key, value] of entries) {
    if (now - value.timestamp < MAX_CACHE_AGE && count < MAX_CACHE_SIZE) {
      updatedCache[key] = value;
      count++;
    }
  }

  // If still too large, remove least recently used
  if (count >= MAX_CACHE_SIZE) {
    const sortedEntries = Object.entries(updatedCache)
      .sort((a, b) => {
        const aIndex = accessOrder.indexOf(a[0]);
        const bIndex = accessOrder.indexOf(b[0]);
        return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
      })
      .slice(0, MAX_CACHE_SIZE - 1);

    updatedCache = Object.fromEntries(sortedEntries);
  }

  return updatedCache;
}

// Get cached weather data if not expired
async function getCachedWeather(location, units) {
  const cache = await loadCache();
  const key = `${location}-${units}`;
  const cached = cache[key];

  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    // Update access order for LRU
    const index = accessOrder.indexOf(key);
    if (index > -1) {
      accessOrder.splice(index, 1);
    }
    accessOrder.push(key);

    return cached.data;
  }

  return null;
}

// Set cached weather data
async function setCachedWeather(location, units, data) {
  const cache = await loadCache();
  const key = `${location}-${units}`;
  cache[key] = {
    data,
    timestamp: Date.now()
  };

  // Update access order
  const index = accessOrder.indexOf(key);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }
  accessOrder.push(key);

  // Evict old entries if needed
  const updatedCache = await evictOldEntries(cache);
  await saveCache(updatedCache);
}

// Clean expired cache entries
async function cleanExpiredCache() {
  const cache = await loadCache();
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of Object.entries(cache)) {
    if (now - value.timestamp >= CACHE_EXPIRY) {
      delete cache[key];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    await saveCache(cache);
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

  for (const [key, value] of Object.entries(cache)) {
    total++;
    if (now - value.timestamp >= CACHE_EXPIRY) {
      expired++;
    } else {
      valid++;
    }
  }

  return { total, expired, valid };
}

// Clear all cache
async function clearCache() {
  const file = getCacheFile();
  await ensureParentDir(file);
  await fs.writeFile(file, '{}');
}

export {
  loadCache,
  saveCache,
  getCachedWeather,
  setCachedWeather,
  cleanExpiredCache,
  getCacheStats,
  clearCache
};
