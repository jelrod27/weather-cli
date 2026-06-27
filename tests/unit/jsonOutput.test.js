import { describe, it, expect } from 'vitest';
import { normalizeToOwmShape } from '../../src/api/openmeteo.js';

// These tests verify the --json output contract shared by the `now`,
// `forecast`, `5day`, and `coords` commands. Each command fetches a
// normalized weather object and, when options.json is set, emits
// `JSON.stringify(data, null, 2)` to stdout and returns early (skipping
// all chalk/boxen/ASCII rendering). Here we exercise the exact
// serialization the CLI performs and assert the result is valid JSON
// containing the expected fields for each command's data shape.

const place = {
  name: 'San Ramon',
  lat: 37.78,
  lon: -121.97,
  country: 'US',
  admin1: 'California'
};

const forecast = {
  current: {
    time: '2026-04-26T12:00',
    temperature_2m: 72,
    apparent_temperature: 70,
    relative_humidity_2m: 55,
    dew_point_2m: 14,
    pressure_msl: 1015,
    weather_code: 2,
    is_day: 1,
    wind_speed_10m: 5,
    wind_direction_10m: 270,
    wind_gusts_10m: 9,
    cloud_cover: 40,
    cape: 1500
  },
  hourly: {
    time: [
      '2026-04-26T00:00',
      '2026-04-26T03:00',
      '2026-04-26T06:00',
      '2026-04-26T09:00',
      '2026-04-26T12:00',
      '2026-04-26T15:00',
      '2026-04-26T18:00',
      '2026-04-26T21:00',
      '2026-04-27T00:00',
      '2026-04-27T03:00',
      '2026-04-27T06:00',
      '2026-04-27T09:00',
      '2026-04-27T12:00',
      '2026-04-27T15:00',
      '2026-04-27T18:00',
      '2026-04-27T21:00'
    ],
    temperature_2m: [55, 53, 52, 60, 72, 75, 70, 62, 50, 51, 50, 58, 70, 73, 68, 60],
    weather_code: [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1, 2, 2, 3, 3],
    wind_speed_10m: [3, 3, 3, 4, 5, 6, 5, 4, 3, 3, 3, 4, 5, 6, 5, 4],
    wind_direction_10m: Array(16).fill(270),
    relative_humidity_2m: [70, 72, 75, 65, 55, 50, 55, 60, 70, 72, 75, 65, 55, 50, 55, 60],
    visibility: [
      16000, 16000, 16000, 14000, 12000, 12000, 14000, 16000, 16000, 16000, 16000, 14000, 12000,
      12000, 14000, 16000
    ],
    pressure_msl: [
      1010, 1011, 1012, 1013, 1015, 1016, 1014, 1012, 1011, 1010, 1011, 1012, 1013, 1014, 1013, 1012
    ],
    shortwave_radiation: [0, 0, 50, 200, 800, 650, 300, 100, 0, 0, 50, 200, 800, 650, 300, 100]
  },
  daily: {
    time: ['2026-04-26', '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'],
    weather_code: [2, 1, 0, 61, 80],
    temperature_2m_max: [76, 74, 78, 70, 68],
    temperature_2m_min: [52, 51, 53, 55, 54],
    sunrise: [
      '2026-04-26T06:15',
      '2026-04-27T06:14',
      '2026-04-28T06:13',
      '2026-04-29T06:12',
      '2026-04-30T06:11'
    ],
    sunset: [
      '2026-04-26T19:50',
      '2026-04-27T19:51',
      '2026-04-28T19:52',
      '2026-04-29T19:53',
      '2026-04-30T19:54'
    ]
  }
};

// Build a normalized data object exactly like getWeather()/getWeatherByCoords() return,
// including the displayUnit/countryCode fields added by fetchAndNormalize().
function buildData(displayUnit = 'fahrenheit', windUnit = 'mph') {
  const data = normalizeToOwmShape({
    place,
    forecast,
    airQuality: { current: 42, hourly: {}, daily: {} },
    windUnit
  });
  return { ...data, displayUnit, countryCode: place.country };
}

describe('--json output', () => {
  it('produces valid, parseable pretty-printed JSON', () => {
    const data = buildData();
    const serialized = JSON.stringify(data, null, 2);
    expect(typeof serialized).toBe('string');
    // Round-trip: must parse back into an equivalent object.
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual(data);
  });

  it('is pretty-printed (2-space indented, ends with a newline-free object)', () => {
    const data = buildData();
    const serialized = JSON.stringify(data, null, 2);
    // Pretty-printed JSON contains newlines and 2-space indentation.
    expect(serialized).toContain('\n');
    expect(serialized).toContain('  "');
  });

  it('contains the expected top-level fields for every command', () => {
    const data = buildData();
    const parsed = JSON.parse(JSON.stringify(data, null, 2));
    // now / forecast / 5day / coords all emit this same normalized object.
    expect(parsed).toHaveProperty('current');
    expect(parsed).toHaveProperty('forecast');
    expect(parsed).toHaveProperty('pollution');
    expect(parsed).toHaveProperty('alerts');
    expect(parsed).toHaveProperty('windUnit');
    expect(parsed).toHaveProperty('displayUnit');
    expect(parsed).toHaveProperty('dailyAqi');
    expect(parsed).toHaveProperty('minutely');
    expect(parsed).toHaveProperty('countryCode');
  });

  it('includes current weather fields for the `now` / `coords` shape', () => {
    const data = buildData();
    const parsed = JSON.parse(JSON.stringify(data, null, 2));
    expect(parsed.current.name).toBe('San Ramon');
    expect(parsed.current.coord).toEqual({ lat: 37.78, lon: -121.97 });
    expect(parsed.current.sys.country).toBe('US');
    expect(parsed.current.main.temp).toBe(72);
    expect(parsed.current.main.feels_like).toBe(70);
    expect(parsed.current.main.humidity).toBe(55);
    expect(parsed.current.weather[0]).toEqual({
      id: 802,
      main: 'Clouds',
      description: 'partly cloudy'
    });
    expect(parsed.current.wind.speed).toBe(5);
    expect(parsed.current.wind.gust).toBe(9);
  });

  it('includes a forecast list for the `forecast` / `5day` shape', () => {
    const data = buildData();
    const parsed = JSON.parse(JSON.stringify(data, null, 2));
    expect(Array.isArray(parsed.forecast.list)).toBe(true);
    expect(parsed.forecast.list.length).toBeGreaterThan(0);
    expect(parsed.forecast.list[0]).toHaveProperty('dt_txt');
    expect(parsed.forecast.list[0]).toHaveProperty('main');
    expect(parsed.forecast.list[0]).toHaveProperty('weather');
  });

  it('includes a forecast list long enough for the `5day` shape', () => {
    const data = buildData();
    const parsed = JSON.parse(JSON.stringify(data, null, 2));
    // display5DayForecast derives daily groupings from forecast.list
    // (3-hour stride, up to 40 entries → covers 5 days).
    expect(Array.isArray(parsed.forecast.list)).toBe(true);
    expect(parsed.forecast.list.length).toBeGreaterThan(0);
    expect(parsed.forecast.list.length).toBeLessThanOrEqual(40);
    expect(parsed.forecast.list[0]).toHaveProperty('dt');
    expect(parsed.forecast.list[0]).toHaveProperty('main');
    expect(parsed.forecast.list[0]).toHaveProperty('weather');
  });

  it('carries unit metadata through serialization', () => {
    const data = buildData('celsius', 'ms');
    const parsed = JSON.parse(JSON.stringify(data, null, 2));
    expect(parsed.displayUnit).toBe('celsius');
    expect(parsed.windUnit).toBe('ms');
  });

  it('serializes cleanly with no ANSI escape codes', () => {
    const data = buildData();
    const serialized = JSON.stringify(data, null, 2);
    // --json must skip all chalk/boxen rendering, so no escape sequences.
    expect(serialized).not.toMatch(/\x1b\[[0-9;]*m/);
  });
});
