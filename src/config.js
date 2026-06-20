import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';

const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
const CONFIG_DIR = join(XDG_CONFIG_HOME, 'weather-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Ensure the config directory exists before any file I/O.
// Called lazily on first read/write so we don't create dirs for mere imports.
let _configDirEnsured = false;
async function ensureConfigDir() {
  if (!_configDirEnsured) {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    _configDirEnsured = true;
  }
}

// Load saved configuration
async function loadConfig() {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Atomically save configuration to file.
// Writes to a temp file first, then renames (atomic on POSIX) to the target.
// This prevents concurrent processes from reading a half-written file and
// avoids the TOCTOU race where two CLI invocations overwrite each other's data.
async function saveConfig(config) {
  await ensureConfigDir();
  const tmpFile = `${CONFIG_FILE}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmpFile, JSON.stringify(config, null, 2));
    await fs.rename(tmpFile, CONFIG_FILE);
  } catch (err) {
    // Clean up the temp file if rename fails
    try {
      await fs.unlink(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

// Get default location
async function getDefaultLocation() {
  const config = await loadConfig();
  return config.defaultLocation || null;
}

// Get default units
async function getDefaultUnits() {
  const config = await loadConfig();
  return config.defaultUnits || 'auto';
}

// Set default location
async function setDefaultLocation(location) {
  const config = await loadConfig();
  config.defaultLocation = location;
  await saveConfig(config);
}

// Set default units
async function setDefaultUnits(units) {
  const config = await loadConfig();
  config.defaultUnits = units;
  await saveConfig(config);
}

// Get configurable cache TTL (in minutes). Returns null if not set.
async function getCacheTtl() {
  const config = await loadConfig();
  return config.cacheTtl ?? null;
}

// Set configurable cache TTL (in minutes). Pass null to reset to default.
async function setCacheTtl(minutes) {
  const config = await loadConfig();
  if (minutes === null) {
    delete config.cacheTtl;
  } else {
    config.cacheTtl = minutes;
  }
  await saveConfig(config);
}

// Process temperature options from command line
function processTemperatureOptions(options) {
  if (options.celsius) return 'celsius';
  if (options.fahrenheit) return 'fahrenheit';
  if (options.units && options.units !== 'auto') {
    return options.units === 'metric' ? 'celsius' : 'fahrenheit';
  }
  return null; // Use auto-detection
}

async function getAsciiConfig() {
  const config = await loadConfig();
  return config.ascii || { enabled: false, style: 'default' };
}

// Reset internal state between tests. Not for production use.
function __resetForTesting() {
  _configDirEnsured = false;
}

export {
  loadConfig,
  saveConfig,
  getDefaultLocation,
  getDefaultUnits,
  setDefaultLocation,
  setDefaultUnits,
  getCacheTtl,
  setCacheTtl,
  processTemperatureOptions,
  getAsciiConfig,
  __resetForTesting
};
