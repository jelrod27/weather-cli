import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Stub the I/O edges so the real watch handler can run in-process:
// no network, no cache file, no config file, no terminal output.
vi.mock('../../src/weather.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getWeather: vi.fn()
}));
vi.mock('../../src/cache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getCachedWeather: vi.fn(),
  setCachedWeather: vi.fn()
}));
vi.mock('../../src/display.js', async (importOriginal) => ({
  ...(await importOriginal()),
  displayCurrentWeather: vi.fn()
}));
vi.mock('../../src/config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getDefaultLocation: vi.fn(),
  getAsciiConfig: vi.fn()
}));

import { registerAll } from '../../src/commands/index.js';
import { parseWatchInterval } from '../../src/utils/validators.js';
import { getWeather } from '../../src/weather.js';
import { getCachedWeather, setCachedWeather } from '../../src/cache.js';
import { displayCurrentWeather } from '../../src/display.js';
import { getAsciiConfig } from '../../src/config.js';

const MINUTE = 60 * 1000;

const sampleData = {
  current: { name: 'London', weather: [{ id: 800, main: 'Clear' }], main: { temp: 18 } },
  displayUnit: 'celsius'
};

function buildProgram() {
  const program = new Command();
  // Throw on commander errors instead of exiting the test runner.
  program.exitOverride();
  registerAll(program);
  return program;
}

function findWatch(program) {
  return program.commands.find((cmd) => cmd.name() === 'watch');
}

async function runWatch(...args) {
  await buildProgram().parseAsync(['watch', ...args], { from: 'user' });
}

describe('watch command', () => {
  describe('registration', () => {
    it('registers "watch [location]" with the shared unit and art options', () => {
      const watch = findWatch(buildProgram());
      expect(watch).toBeDefined();

      const [location] = watch.registeredArguments;
      expect(location.name()).toBe('location');
      expect(location.required).toBe(false);

      const longFlags = watch.options.map((opt) => opt.long);
      expect(longFlags).toEqual(
        expect.arrayContaining([
          '--interval',
          '--units',
          '--celsius',
          '--fahrenheit',
          '--json',
          '--art',
          '--art-style'
        ])
      );
    });

    it('exposes -i, --interval <minutes> defaulting to 5', () => {
      const interval = findWatch(buildProgram()).options.find((opt) => opt.long === '--interval');
      expect(interval.short).toBe('-i');
      expect(interval.required).toBe(true); // <minutes> takes a value
      expect(interval.defaultValue).toBe('5');
    });
  });

  describe('parseWatchInterval', () => {
    it('accepts whole minutes from 1 to 60', () => {
      expect(parseWatchInterval('1')).toBe(1);
      expect(parseWatchInterval('5')).toBe(5);
      expect(parseWatchInterval('30')).toBe(30);
      expect(parseWatchInterval('60')).toBe(60);
    });

    it('falls back to 5 for out-of-range values', () => {
      expect(parseWatchInterval('0')).toBe(5);
      expect(parseWatchInterval('61')).toBe(5);
      expect(parseWatchInterval('-3')).toBe(5);
      expect(parseWatchInterval('100')).toBe(5);
    });

    it('falls back to 5 for non-numeric input', () => {
      expect(parseWatchInterval('abc')).toBe(5);
      expect(parseWatchInterval('')).toBe(5);
      expect(parseWatchInterval(undefined)).toBe(5);
      expect(parseWatchInterval(NaN)).toBe(5);
    });
  });

  describe('action', () => {
    let sigintBefore;

    beforeEach(() => {
      vi.useFakeTimers();
      sigintBefore = new Set(process.listeners('SIGINT'));
      getCachedWeather.mockResolvedValue(null);
      setCachedWeather.mockResolvedValue(undefined);
      getWeather.mockResolvedValue(sampleData);
      getAsciiConfig.mockResolvedValue({ enabled: false, style: 'default' });
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'clear').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Remove only the SIGINT listeners this test added; vitest has its own.
      for (const listener of process.listeners('SIGINT')) {
        if (!sigintBefore.has(listener)) process.off('SIGINT', listener);
      }
      vi.restoreAllMocks();
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.clearAllMocks();
    });

    it('clears the screen and renders immediately, then refreshes on the parsed interval', async () => {
      await runWatch('London', '--interval', '2');

      expect(getWeather).toHaveBeenCalledTimes(1);
      expect(getWeather.mock.calls[0][0]).toBe('London');
      expect(console.clear).toHaveBeenCalledTimes(1);
      expect(displayCurrentWeather).toHaveBeenCalledTimes(1);
      expect(displayCurrentWeather).toHaveBeenCalledWith(sampleData, 'celsius', expect.any(Object));

      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(displayCurrentWeather).toHaveBeenCalledTimes(1); // 1 of 2 minutes elapsed

      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(console.clear).toHaveBeenCalledTimes(2);
      expect(displayCurrentWeather).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(2 * MINUTE);
      expect(displayCurrentWeather).toHaveBeenCalledTimes(3);
    });

    it('falls back to a 5 minute refresh for an out-of-range --interval', async () => {
      await runWatch('London', '--interval', '99');

      await vi.advanceTimersByTimeAsync(4 * MINUTE);
      expect(displayCurrentWeather).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(displayCurrentWeather).toHaveBeenCalledTimes(2);
    });

    it('serves cached data without fetching', async () => {
      getCachedWeather.mockResolvedValue(sampleData);
      await runWatch('London');

      expect(getWeather).not.toHaveBeenCalled();
      expect(displayCurrentWeather).toHaveBeenCalledWith(sampleData, 'celsius', expect.any(Object));
    });

    it('installs a SIGINT handler that clears the screen and exits 0', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
      await runWatch('London');

      const added = process.listeners('SIGINT').filter((l) => !sigintBefore.has(l));
      expect(added).toHaveLength(1);

      console.clear.mockClear();
      added[0]();
      expect(console.clear).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('reports a failed refresh and keeps the loop alive', async () => {
      await runWatch('London', '--interval', '1');
      getWeather.mockRejectedValueOnce(new Error('boom'));

      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Refresh failed: boom'));
      expect(displayCurrentWeather).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(MINUTE);
      expect(displayCurrentWeather).toHaveBeenCalledTimes(2);
    });
  });
});
