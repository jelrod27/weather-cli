import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const APP_NAME = 'weather-cli';

function joinHome(...segments) {
  return path.join(os.homedir(), ...segments);
}

function getConfigDir() {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || joinHome('AppData', 'Roaming');
    return path.join(appdata, APP_NAME);
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  return path.join(xdg || joinHome('.config'), APP_NAME);
}

function getCacheDir() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || joinHome('AppData', 'Local');
    return path.join(local, APP_NAME);
  }
  const xdg = process.env.XDG_CACHE_HOME;
  return path.join(xdg || joinHome('.cache'), APP_NAME);
}

export function getConfigFile() {
  return path.join(getConfigDir(), 'config.json');
}

export function getCacheFile() {
  return path.join(getCacheDir(), 'cache.json');
}

// Files written by older versions lived next to the installed package.
// resolve() walks up two levels from src/utils/ to the package root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

export function getLegacyConfigFile() {
  return path.join(PACKAGE_ROOT, '.weather-config.json');
}

export function getLegacyCacheFile() {
  return path.join(PACKAGE_ROOT, '.weather-cache.json');
}

export async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function migrateOne(legacyPath, newPath) {
  try {
    await fs.access(newPath);
    return false;
  } catch {
    // new file does not exist yet, fall through to migration
  }
  let data;
  try {
    data = await fs.readFile(legacyPath, 'utf8');
  } catch {
    return false;
  }
  await ensureParentDir(newPath);
  await fs.writeFile(newPath, data);
  try {
    await fs.unlink(legacyPath);
  } catch {
    // best-effort cleanup; ignore if we cannot remove the legacy file
  }
  return true;
}

export async function migrateLegacyFiles() {
  await Promise.all([
    migrateOne(getLegacyConfigFile(), getConfigFile()),
    migrateOne(getLegacyCacheFile(), getCacheFile())
  ]);
}
