import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('../../src/api/http.js', () => ({
  default: { get }
}));

const { fetchForecast, fetchAirQuality, geocode, normalizeToOwmShape } =
  await import('../../src/api/openmeteo.js');

describe('fetchForecast timestamp contract', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: {} });
  });

  it('requests Unix timestamps while preserving the location timezone', async () => {
    await fetchForecast(51.5, -0.12, {
      tempUnit: 'celsius',
      windUnit: 'ms'
    });

    expect(get).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          timezone: 'auto',
          timeformat: 'unixtime'
        })
      })
    );
  });
});

describe('geocode response contract', () => {
  beforeEach(() => get.mockReset());

  it('does not silently discard an explicit country constraint', async () => {
    get.mockResolvedValue({
      data: {
        results: [{ name: 'London', latitude: 51.5, longitude: -0.12, country_code: 'GB' }]
      }
    });
    await expect(geocode('London, US')).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('rejects a non-array results payload as upstream data corruption', async () => {
    get.mockResolvedValue({ data: { results: {} } });
    await expect(geocode('London')).rejects.toMatchObject({ code: 'UPSTREAM_DATA_ERROR' });
  });
});

describe('fetchAirQuality', () => {
  beforeEach(() => get.mockReset());

  it('derives daily AQI from hourly averages', async () => {
    get.mockResolvedValue({
      data: {
        current: { us_aqi: 60 },
        hourly: {
          time: ['2026-08-01T00:00', '2026-08-01T01:00', '2026-08-01T02:00'],
          us_aqi: [50, 60, 70]
        }
      }
    });
    const result = await fetchAirQuality(51.5, -0.12);
    expect(result.current).toBe(60);
    expect(result.daily.time).toHaveLength(1);
    expect(result.daily.us_aqi[0]).toBe(60); // avg of 50,60,70
    expect(get).toHaveBeenCalledWith(
      'https://air-quality-api.open-meteo.com/v1/air-quality',
      expect.anything()
    );
  });

  it('returns empty data when the API call fails (AQ is non-essential)', async () => {
    get.mockRejectedValueOnce(new Error('network down'));
    const result = await fetchAirQuality(51.5, -0.12);
    expect(result).toEqual({ current: null, hourly: {}, daily: {} });
  });
});

describe('normalizeToOwmShape timestamp contract', () => {
  it('preserves Unix timestamps and the provider timezone', () => {
    const currentTime = 1784476800;
    const sunrise = 1784433960;
    const sunset = 1784491620;
    const data = normalizeToOwmShape({
      place: { name: 'London', lat: 51.5, lon: -0.12, country: 'GB' },
      forecast: {
        timezone: 'Europe/London',
        utc_offset_seconds: 3600,
        current: {
          time: currentTime,
          temperature_2m: 22,
          apparent_temperature: 21,
          relative_humidity_2m: 55,
          pressure_msl: 1015,
          weather_code: 2,
          wind_speed_10m: 3,
          wind_direction_10m: 180
        },
        hourly: {
          time: [currentTime],
          temperature_2m: [22],
          weather_code: [2],
          wind_speed_10m: [3],
          wind_direction_10m: [180],
          relative_humidity_2m: [55],
          visibility: [10000]
        },
        daily: {
          sunrise: [sunrise],
          sunset: [sunset],
          temperature_2m_min: [15],
          temperature_2m_max: [24]
        }
      },
      airQuality: { current: null, hourly: {}, daily: {} }
    });

    expect(data.timezone).toBe('Europe/London');
    expect(data.current.dt).toBe(currentTime);
    expect(data.current.sys.sunrise).toBe(sunrise);
    expect(data.current.sys.sunset).toBe(sunset);
  });

  it('rejects malformed forecast payloads with a typed upstream-data error', () => {
    expect(() =>
      normalizeToOwmShape({
        place: { name: 'London', lat: 51.5, lon: -0.12, country: 'GB' },
        forecast: null,
        airQuality: null
      })
    ).toThrowError(
      expect.objectContaining({
        name: 'WeatherError',
        code: 'UPSTREAM_DATA_ERROR'
      })
    );
  });
});
