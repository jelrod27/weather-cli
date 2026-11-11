import { Command } from 'commander';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Keep prompts, config persistence, and weather rendering real; replace only the network boundary.
vi.mock('../../src/weather.js', () => ({
  getWeather: vi.fn(),
  getWeatherByCoords: vi.fn()
}));

let directory;
let input;
let output;
let controller;
let activeCommand;
const pendingInputs = new Set();

beforeEach(async () => {
  vi.resetModules();
  controller = new AbortController();
  activeCommand = undefined;
  directory = await mkdtemp(join(tmpdir(), 'weather-prompts-'));
  vi.stubEnv('XDG_CONFIG_HOME', directory);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  for (const immediate of pendingInputs) clearImmediate(immediate);
  pendingInputs.clear();
  controller.abort();
  await activeCommand?.catch(() => {});
  input?.destroy();
  output?.destroy();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

async function runPromptCommand(command, replies) {
  const { default: inquirer } = await import('inquirer');
  const { registerAll } = await import('../../src/commands/index.js');
  input = new PassThrough();
  let replyIndex = 0;
  output = new Writable({
    write(chunk, _encoding, callback) {
      const reply = replies[replyIndex];
      if (reply && chunk.toString().includes(reply.message)) {
        replyIndex += 1;
        // Wait until the real prompt has installed its keypress handlers.
        const immediate = setImmediate(() => {
          pendingInputs.delete(immediate);
          input.write(reply.keys);
        });
        pendingInputs.add(immediate);
      }
      callback();
    }
  });
  // A shared terminal output stays writable when each individual prompt ends.
  vi.spyOn(output, 'end').mockImplementation(() => output);
  const prompt = inquirer.createPromptModule({ input, output, signal: controller.signal });
  vi.spyOn(inquirer, 'prompt').mockImplementation(prompt);
  const program = new Command().name('weather');
  registerAll(program);
  activeCommand = program.parseAsync([command], { from: 'user' });
  await activeCommand;
  return JSON.parse(await readFile(join(directory, 'weather-cli', 'config.json'), 'utf8'));
}

describe('interactive commands with the installed Inquirer', () => {
  it('saves configuration after choosing units and entering a cache TTL', async () => {
    const config = await runPromptCommand('config', [
      { message: 'Default location:', keys: 'London\r' },
      { message: 'Default temperature units:', keys: '\u001b[B\r' },
      { message: 'Cache TTL in minutes', keys: '45\r' }
    ]);

    expect(config).toMatchObject({
      defaultLocation: 'London',
      defaultUnits: 'celsius',
      cacheTtl: 45
    });
  });

  it('renders current weather after choosing units and forecast, then saves confirmed defaults', async () => {
    const { getWeather } = await import('../../src/weather.js');
    const { normalizeToOwmShape } = await import('../../src/weatherReport.js');
    getWeather.mockResolvedValue({
      ...normalizeToOwmShape({
        place: { name: 'London', lat: 51.5, lon: -0.12, country: 'GB' },
        forecast: { current: { temperature_2m: 20, weather_code: 0 } },
        airQuality: { current: null },
        windUnit: 'ms'
      }),
      displayUnit: 'celsius'
    });
    const config = await runPromptCommand('interactive', [
      { message: 'Enter location:', keys: 'London\r' },
      { message: 'Temperature units:', keys: '\u001b[B\r' },
      { message: 'What would you like to see?', keys: '\r' },
      { message: 'Save as default location?', keys: 'y\r' }
    ]);

    expect(config).toMatchObject({ defaultLocation: 'London', defaultUnits: 'celsius' });
    expect(console.log.mock.calls.flat().join('\n')).toContain('20°C');
  });
});
