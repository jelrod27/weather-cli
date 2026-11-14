import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/weather.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getWeather: vi.fn(),
  getWeatherByCoords: vi.fn()
}));
vi.mock('../../src/cache.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getCachedWeather: vi.fn(),
  setCachedWeather: vi.fn()
}));
vi.mock('../../src/config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getDefaultLocation: vi.fn(),
  getAsciiConfig: vi.fn()
}));
vi.mock('../../src/display.js', () => ({
  displayCurrentWeather: vi.fn(),
  display24HourForecast: vi.fn(),
  display5DayForecast: vi.fn(),
  displayMinutelyForecast: vi.fn()
}));
vi.mock('../../src/api/openmeteo.js', async (importOriginal) => ({
  ...(await importOriginal()),
  geocode: vi.fn()
}));
vi.mock('../../src/api/historical.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchHistorical: vi.fn()
}));
vi.mock('../../src/api/marine.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchMarine: vi.fn()
}));

import { registerAll } from '../../src/commands/index.js';
import { getWeather, getWeatherByCoords } from '../../src/weather.js';
import { getCachedWeather } from '../../src/cache.js';
import { getDefaultLocation, getAsciiConfig } from '../../src/config.js';
import { geocode } from '../../src/api/openmeteo.js';
import { fetchHistorical } from '../../src/api/historical.js';
import { fetchMarine } from '../../src/api/marine.js';
import { display24HourForecast, display5DayForecast } from '../../src/display.js';

const weather = { current: { main: { temp: 18 } }, displayUnit: 'celsius' };
const locationCommands = ['now', 'forecast', '5day', 'radar', 'watch', 'marine', 'history'];

async function runCommand(args) {
  const program = new Command().name('weather').exitOverride();
  program.configureOutput({ writeErr: () => {} });
  registerAll(program);
  await program.parseAsync(args, { from: 'user' });
}

function locationBoundary(command) {
  return command === 'marine' || command === 'history' ? geocode : getWeather;
}

function commandArgs(command, locationWords) {
  return [command, ...locationWords, ...(command === 'history' ? ['--date', '2023-07-15'] : [])];
}

describe('CLI location dispatch', () => {
  let sigintBefore;

  beforeEach(() => {
    vi.useFakeTimers();
    sigintBefore = new Set(process.listeners('SIGINT'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'clear').mockImplementation(() => {});
    getCachedWeather.mockResolvedValue(null);
    getWeather.mockResolvedValue(weather);
    getWeatherByCoords.mockResolvedValue(weather);
    getDefaultLocation.mockResolvedValue('Seattle, WA');
    getAsciiConfig.mockResolvedValue({ enabled: false, style: 'default' });
    geocode.mockResolvedValue({
      name: 'San Ramon',
      admin1: 'California',
      country: 'US',
      lat: 37,
      lon: -121
    });
    fetchMarine.mockResolvedValue(null);
    fetchHistorical.mockResolvedValue({ date: '2023-07-15', description: 'Clear' });
  });

  afterEach(() => {
    for (const listener of process.listeners('SIGINT')) {
      if (!sigintBefore.has(listener)) process.off('SIGINT', listener);
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe.each(locationCommands)('%s', (command) => {
    it.each([
      { args: ['san', 'ramon', 'ca'], expected: 'san ramon ca', label: 'unquoted words' },
      { args: ['San Ramon CA'], expected: 'San Ramon CA', label: 'a quoted location' },
      { args: ['San', 'Ramon,CA'], expected: 'San Ramon, CA', label: 'comma normalization' },
      { args: ['imperial'], expected: 'imperial', label: 'a city named after a unit system' },
      { args: ['imperial', 'ca'], expected: 'imperial ca', label: 'a unit-named city and state' }
    ])('fetches the complete location from $label', async ({ args, expected }) => {
      await runCommand(commandArgs(command, args));

      expect(locationBoundary(command).mock.calls[0][0]).toBe(expected);
      expect(getDefaultLocation).not.toHaveBeenCalled();
    });

    it('uses the configured default when location is omitted', async () => {
      await runCommand(commandArgs(command, []));

      expect(locationBoundary(command).mock.calls[0][0]).toBe('Seattle, WA');
    });
  });

  it('keeps subcommand options separate from unquoted location words', async () => {
    await runCommand(['forecast', 'San', 'Ramon', 'CA', '--fahrenheit']);

    expect(getWeather).toHaveBeenCalledWith('San Ramon CA', 'fahrenheit');
    expect(display24HourForecast).toHaveBeenCalledWith(weather, 'celsius');
  });

  it.each([
    ['-u', 'metric'],
    ['--units', 'metric']
  ])('preserves a unit-named city when using %s %s', async (flag, unit) => {
    await runCommand(['now', flag, unit, 'imperial', 'ca']);

    expect(getWeather).toHaveBeenCalledWith('imperial ca', 'celsius');
  });

  it('retains root shorthand support for unquoted locations', async () => {
    await runCommand(['San', 'Ramon', 'CA']);

    expect(getWeather).toHaveBeenCalledWith('San Ramon CA', null);
  });

  it('renders the five-day forecast after resolving the location', async () => {
    await runCommand(['5day', 'San', 'Ramon', 'CA']);

    expect(display5DayForecast).toHaveBeenCalledWith(weather, 'celsius');
  });

  it('keeps quoted compare locations as two separate cities', async () => {
    await runCommand(['compare', 'San Ramon CA', 'New York NY']);

    expect(getWeather).toHaveBeenNthCalledWith(1, 'San Ramon CA', null);
    expect(getWeather).toHaveBeenNthCalledWith(2, 'New York NY', null);
  });

  it('rejects ambiguous unquoted compare locations', async () => {
    await expect(runCommand(['compare', 'San', 'Ramon', 'New', 'York'])).rejects.toMatchObject({
      code: 'commander.excessArguments'
    });
    expect(getWeather).not.toHaveBeenCalled();
  });

  it('continues to dispatch coordinate pairs without location parsing', async () => {
    await runCommand(['coords', '37.77,-122.42']);

    expect(getWeatherByCoords).toHaveBeenCalledWith('37.77', '-122.42', null);
    expect(getWeather).not.toHaveBeenCalled();
  });
});
