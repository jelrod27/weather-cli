import fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../src/api/http.js', () => ({ default: { get } }));

describe('provider text through the persistent status cache', () => {
  let directory;

  beforeEach(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'weather-cli-provider-status-'));
    vi.stubEnv('XDG_CACHE_HOME', join(directory, 'cache'));
    vi.stubEnv('XDG_CONFIG_HOME', join(directory, 'config'));
    vi.resetModules();
    get.mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('persists sanitized provider text and renders a safe status after a fresh cache read', async () => {
    get.mockImplementation(async (url) => {
      if (url.includes('geocoding-api')) {
        return {
          data: {
            results: [
              {
                name: '\x1b_hidden payload\x1b\\\x1b[31mLondon\x1b[0m',
                latitude: 51.5,
                longitude: -0.12,
                country_code: 'US',
                admin1: '\x1b]0;hidden title\x07England'
              }
            ]
          }
        };
      }
      if (url.includes('api.open-meteo.com/v1/forecast')) {
        return {
          data: {
            timezone: 'Europe/London',
            current: { time: 1794139200, temperature_2m: 12, weather_code: 0 },
            hourly: { time: [], temperature_2m: [], weather_code: [] },
            daily: { temperature_2m_min: [10], temperature_2m_max: [15] }
          }
        };
      }
      if (url.includes('air-quality-api')) {
        return { data: { current: { us_aqi: 20 }, hourly: { time: [], us_aqi: [] } } };
      }
      if (url.includes('api.weather.gov')) {
        return {
          data: {
            features: [
              {
                properties: {
                  event: '\x1bPignored payload\x1b\\Flood Watch',
                  headline: '\x1b]0;hidden title\x07Watch for flooding',
                  description: '\x9fhidden payload\x9cStay alert.',
                  severity: 'Moderate',
                  urgency: 'Expected',
                  areaDesc: 'London'
                }
              }
            ]
          }
        };
      }
      throw new Error(`Unexpected provider URL: ${url}`);
    });

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Unexpected status exit: ${code}`);
    });
    const { runStatus } = await import('../../src/commands/status.js');
    const config = await import('../../src/config.js');

    await runStatus(['London'], { refresh: true, noEmoji: true, celsius: true }, config);

    const persisted = JSON.parse(
      await fs.readFile(join(directory, 'cache/weather-cli/cache.json'), 'utf8')
    );
    const report = Object.values(persisted)[0].data;
    expect(report.current.name).toBe('London');
    expect(report.alerts[0]).toMatchObject({
      event: 'Flood Watch',
      headline: 'Watch for flooding',
      description: 'Stay alert.'
    });

    // Re-import the real consumers to require a disk read rather than reuse
    // an in-memory report, and make all provider access fail on a cache hit.
    vi.resetModules();
    get.mockRejectedValue(new Error('Provider must not be called for a cache hit'));
    stdout.mockClear();
    const { runStatus: cachedStatus } = await import('../../src/commands/status.js');
    const cachedConfig = await import('../../src/config.js');

    await cachedStatus(['London'], { noEmoji: true, celsius: true }, cachedConfig);

    const output = stdout.mock.calls.map(([text]) => text).join('');
    expect(output.replace(/\x1b\[[0-9;]*m/g, '')).toBe('London 12°C ↑15 ↓10\n');
  });
});
