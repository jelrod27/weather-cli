import { Command } from 'commander';
import inquirer from 'inquirer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/weather.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getWeather: vi.fn()
}));
vi.mock('../../src/display.js', () => ({
  displayCurrentWeather: vi.fn(),
  display24HourForecast: vi.fn(),
  display5DayForecast: vi.fn(),
  displayMinutelyForecast: vi.fn()
}));
vi.mock('../../src/config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getDefaultLocation: vi.fn(),
  getDefaultUnits: vi.fn(),
  getCacheTtl: vi.fn(),
  setDefaultLocation: vi.fn(),
  setDefaultUnits: vi.fn(),
  setCacheTtl: vi.fn()
}));

import { registerAll } from '../../src/commands/index.js';
import { getWeather } from '../../src/weather.js';
import {
  displayCurrentWeather,
  display24HourForecast,
  display5DayForecast
} from '../../src/display.js';
import {
  getDefaultLocation,
  getDefaultUnits,
  getCacheTtl,
  setDefaultLocation,
  setDefaultUnits,
  setCacheTtl
} from '../../src/config.js';

const weather = { current: { main: { temp: 18 } }, displayUnit: 'fahrenheit' };

async function runCommand(args) {
  const program = new Command().name('weather').exitOverride();
  registerAll(program);
  await program.parseAsync(args, { from: 'user' });
}

// Use Inquirer's real runner and installed prompt registry. Replace only the
// terminal-facing prompt implementations, retaining unknown-type validation.
function answerPrompts(answers) {
  const prompt = inquirer.createPromptModule();
  for (const type of Object.keys(prompt.prompts)) {
    prompt.registerPrompt(type, async (question) => {
      const answer = answers[question.name] ?? question.default;
      if (question.choices) {
        expect(question.choices.some((choice) => choice.value === answer)).toBe(true);
      }
      return answer;
    });
  }
  vi.spyOn(inquirer, 'prompt').mockImplementation((questions) => prompt(questions));
}

describe('interactive CLI prompts', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    getDefaultLocation.mockResolvedValue('Seattle, WA');
    getDefaultUnits.mockResolvedValue('fahrenheit');
    getCacheTtl.mockResolvedValue(60);
    getWeather.mockResolvedValue(weather);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each([{ args: [] }, { args: ['interactive'] }, { args: ['i'] }])(
    'completes interactive invocation $args',
    async ({ args }) => {
      answerPrompts({ location: 'San Ramon CA', units: 'fahrenheit', forecast: 'all', save: true });

      await runCommand(args);

      expect(getWeather).toHaveBeenCalledWith('San Ramon CA', 'fahrenheit');
      expect(displayCurrentWeather).toHaveBeenCalledWith(weather, 'fahrenheit');
      expect(display24HourForecast).toHaveBeenCalledWith(weather, 'fahrenheit');
      expect(display5DayForecast).toHaveBeenCalledWith(weather, 'fahrenheit');
      expect(setDefaultLocation).toHaveBeenCalledWith('San Ramon CA');
      expect(setDefaultUnits).toHaveBeenCalledWith('fahrenheit');
    }
  );

  it('uses saved location and units without saving when confirmation is declined', async () => {
    answerPrompts({ forecast: 'current', save: false });

    await runCommand([]);

    expect(getWeather).toHaveBeenCalledWith('Seattle, WA', 'fahrenheit');
    expect(displayCurrentWeather).toHaveBeenCalledWith(weather, 'fahrenheit');
    expect(display24HourForecast).not.toHaveBeenCalled();
    expect(display5DayForecast).not.toHaveBeenCalled();
    expect(setDefaultLocation).not.toHaveBeenCalled();
    expect(setDefaultUnits).not.toHaveBeenCalled();
  });

  it('completes config prompts and persists the selected settings', async () => {
    answerPrompts({ defaultLocation: 'San Ramon CA', defaultUnits: 'celsius', cacheTtl: '15' });

    await runCommand(['config']);

    expect(setDefaultLocation).toHaveBeenCalledWith('San Ramon CA');
    expect(setDefaultUnits).toHaveBeenCalledWith('celsius');
    expect(setCacheTtl).toHaveBeenCalledWith(15);
  });
});
