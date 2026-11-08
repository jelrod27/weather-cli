import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';

// Mock fs/promises to test config I/O — must include mkdir, rename and unlink for atomic writes
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

// Import after mocking
const configModule = await import('../../src/config.js');
const {
  loadConfig,
  saveConfig,
  getDefaultLocation,
  getDefaultUnits,
  setDefaultLocation,
  setDefaultUnits,
  getCacheTtl,
  setCacheTtl,
  getAsciiConfig,
  processTemperatureOptions,
  __resetForTesting
} = configModule;

// Reset module-level _configDirEnsured flag between tests so
// ensureConfigDir re-runs and fs.mkdir gets called again.
afterEach(() => {
  __resetForTesting();
});

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed config when file exists', async () => {
    const configData = { defaultLocation: 'London', defaultUnits: 'celsius' };
    fs.readFile.mockResolvedValue(JSON.stringify(configData));

    const result = await loadConfig();
    expect(result).toEqual(configData);
    expect(fs.mkdir).toHaveBeenCalled();
  });

  it('returns empty object when file does not exist', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await loadConfig();
    expect(result).toEqual({});
  });

  it('returns empty object for invalid JSON', async () => {
    fs.readFile.mockResolvedValue('not-json');

    const result = await loadConfig();
    expect(result).toEqual({});
  });
});

describe('saveConfig (atomic write)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes to temp file then renames to target', async () => {
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await saveConfig({ defaultLocation: 'Paris' });

    // Should write to a temp file first
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      JSON.stringify({ defaultLocation: 'Paris' }, null, 2),
      { mode: 0o600 }
    );
    // Then atomically rename to the real config file
    expect(fs.rename).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.stringContaining('config.json')
    );
  });

  it('creates the config directory owner-only', async () => {
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await saveConfig({ defaultLocation: 'Paris' });

    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('weather-cli'),
      expect.objectContaining({ mode: 0o700 })
    );
  });

  it('cleans up temp file if rename fails', async () => {
    fs.writeFile.mockResolvedValue();
    fs.rename.mockRejectedValue(new Error('rename failed'));
    fs.unlink.mockResolvedValue();

    await expect(saveConfig({ defaultLocation: 'Paris' })).rejects.toThrow('rename failed');

    // Should attempt to clean up the temp file
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
  });
});

describe('getDefaultLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns saved default location', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultLocation: 'Tokyo' }));

    const result = await getDefaultLocation();
    expect(result).toBe('Tokyo');
  });

  it('returns null when no default location is set', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await getDefaultLocation();
    expect(result).toBeNull();
  });
});

describe('getDefaultUnits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns saved default units', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultUnits: 'fahrenheit' }));

    const result = await getDefaultUnits();
    expect(result).toBe('fahrenheit');
  });

  it('returns auto when no default units are set', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await getDefaultUnits();
    expect(result).toBe('auto');
  });
});

describe('setDefaultLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets default location while preserving other config', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultUnits: 'celsius' }));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await setDefaultLocation('Berlin');

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.defaultLocation).toBe('Berlin');
    expect(parsed.defaultUnits).toBe('celsius');
  });
});

describe('setDefaultUnits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets default units while preserving other config', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultLocation: 'London' }));
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();

    await setDefaultUnits('fahrenheit');

    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.defaultUnits).toBe('fahrenheit');
    expect(parsed.defaultLocation).toBe('London');
  });
});

describe('getAsciiConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns saved ascii config', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ ascii: { enabled: true, style: 'retro' } }));

    const result = await getAsciiConfig();
    expect(result).toEqual({ enabled: true, style: 'retro' });
  });

  it('returns defaults when no ascii config is set', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await getAsciiConfig();
    expect(result).toEqual({ enabled: false, style: 'default' });
  });
});

describe('processTemperatureOptions', () => {
  it('returns "celsius" when --celsius flag is set', () => {
    expect(processTemperatureOptions({ celsius: true })).toBe('celsius');
  });

  it('returns "fahrenheit" when --fahrenheit flag is set', () => {
    expect(processTemperatureOptions({ fahrenheit: true })).toBe('fahrenheit');
  });

  it('returns "celsius" for units=metric', () => {
    expect(processTemperatureOptions({ units: 'metric' })).toBe('celsius');
  });

  it('returns "fahrenheit" for units=imperial', () => {
    expect(processTemperatureOptions({ units: 'imperial' })).toBe('fahrenheit');
  });

  it('returns null for units=auto (auto-detection)', () => {
    expect(processTemperatureOptions({ units: 'auto' })).toBeNull();
  });

  it('returns null when no unit options are set', () => {
    expect(processTemperatureOptions({})).toBeNull();
  });

  it('prioritizes --celsius flag over units option', () => {
    expect(processTemperatureOptions({ celsius: true, units: 'imperial' })).toBe('celsius');
  });

  it('prioritizes --fahrenheit flag over units option', () => {
    expect(processTemperatureOptions({ fahrenheit: true, units: 'metric' })).toBe('fahrenheit');
  });
});

describe('cache TTL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.writeFile.mockResolvedValue();
    fs.rename.mockResolvedValue();
  });

  it('getCacheTtl returns null when not set', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultLocation: 'London' }));
    expect(await getCacheTtl()).toBeNull();
  });

  it('getCacheTtl returns the configured value', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ cacheTtl: 60 }));
    expect(await getCacheTtl()).toBe(60);
  });

  it('setCacheTtl writes the value to config', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ defaultLocation: 'Paris' }));
    await setCacheTtl(120);
    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.cacheTtl).toBe(120);
    expect(parsed.defaultLocation).toBe('Paris');
  });

  it('setCacheTtl with null removes the key', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ cacheTtl: 60, defaultLocation: 'NYC' }));
    await setCacheTtl(null);
    const writtenContent = fs.writeFile.mock.calls[0][1];
    const parsed = JSON.parse(writtenContent);
    expect(parsed.cacheTtl).toBeUndefined();
    expect(parsed.defaultLocation).toBe('NYC');
  });
});
