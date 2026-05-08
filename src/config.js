import fs from 'fs/promises';
import { ensureParentDir, getConfigFile } from './utils/paths.js';

// Load saved configuration
async function loadConfig() {
  try {
    const data = await fs.readFile(getConfigFile(), 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Save configuration
async function saveConfig(config) {
  const file = getConfigFile();
  await ensureParentDir(file);
  await fs.writeFile(file, JSON.stringify(config, null, 2));
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

async function setAsciiConfig(asciiConfig) {
  const config = await loadConfig();
  config.ascii = { ...(config.ascii || {}), ...asciiConfig };
  await saveConfig(config);
}

export {
  loadConfig,
  saveConfig,
  getDefaultLocation,
  getDefaultUnits,
  setDefaultLocation,
  setDefaultUnits,
  processTemperatureOptions,
  getAsciiConfig,
  setAsciiConfig
};
