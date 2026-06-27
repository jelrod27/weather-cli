import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared httpClient so fetchHistorical never hits the network.
vi.mock('../../src/api/http.js', () => ({
  default: {
    get: vi.fn()
  }
}));

// Import after mocks are registered.
import httpClient from '../../src/api/http.js';
import { fetchHistorical, isValidDate } from '../../src/api/historical.js';

function archiveResponse(overrides = {}) {
  const daily = {
    time: ['2023-07-15'],
    temperature_2m_max: [30.5],
    temperature_2m_min: [18.2],
    temperature_2m_mean: [24.3],
    precipitation_sum: [1.4],
    wind_speed_10m_max: [22.1],
    weather_code: [3],
    ...overrides
  };
  return { data: { daily } };
}

describe('isValidDate', () => {
  it('accepts a well-formed YYYY-MM-DD string', () => {
    expect(isValidDate('2023-07-15')).toBe(true);
  });

  it('accepts a leap day', () => {
    expect(isValidDate('2020-02-29')).toBe(true);
  });

  it('rejects Feb 30 (not a real calendar date)', () => {
    expect(isValidDate('2023-02-30')).toBe(false);
  });

  it('rejects a non-leap Feb 29', () => {
    expect(isValidDate('2023-02-29')).toBe(false);
  });

  it('rejects wrong separators', () => {
    expect(isValidDate('2023/07/15')).toBe(false);
  });

  it('rejects short year/month/day', () => {
    expect(isValidDate('23-07-15')).toBe(false);
    expect(isValidDate('2023-7-15')).toBe(false);
    expect(isValidDate('2023-07-5')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate(20230715)).toBe(false);
    expect(isValidDate(new Date())).toBe(false);
  });

  it('rejects garbage', () => {
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('fetchHistorical', () => {
  beforeEach(() => {
    httpClient.get.mockReset();
  });

  it('calls the archive endpoint with the right params and normalizes the response', async () => {
    httpClient.get.mockResolvedValueOnce(archiveResponse());

    const result = await fetchHistorical(37.78, -122.41, '2023-07-15');

    expect(httpClient.get).toHaveBeenCalledTimes(1);
    const [url, config] = httpClient.get.mock.calls[0];
    expect(url).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(config.params).toMatchObject({
      latitude: 37.78,
      longitude: -122.41,
      start_date: '2023-07-15',
      end_date: '2023-07-15',
      timezone: 'auto'
    });
    expect(config.params.daily).toContain('temperature_2m_max');
    expect(config.params.daily).toContain('temperature_2m_min');
    expect(config.params.daily).toContain('temperature_2m_mean');
    expect(config.params.daily).toContain('precipitation_sum');
    expect(config.params.daily).toContain('wind_speed_10m_max');
    expect(config.params.daily).toContain('weather_code');

    expect(result).toEqual({
      date: '2023-07-15',
      tempMax: 30.5,
      tempMin: 18.2,
      tempMean: 24.3,
      precipSum: 1.4,
      maxWind: 22.1,
      weatherCode: { id: 804, main: 'Clouds', description: 'overcast' },
      description: 'overcast'
    });
  });

  it('maps the WMO weather code through wmoToOwm', async () => {
    // weather_code 61 → slight rain
    httpClient.get.mockResolvedValueOnce(archiveResponse({ weather_code: [61] }));

    const result = await fetchHistorical(40.71, -74.0, '2023-01-10');

    expect(result.weatherCode).toEqual({ id: 500, main: 'Rain', description: 'slight rain' });
    expect(result.description).toBe('slight rain');
  });

  it('falls back to the unknown description for an unrecognized WMO code', async () => {
    httpClient.get.mockResolvedValueOnce(archiveResponse({ weather_code: [9999] }));

    const result = await fetchHistorical(40.71, -74.0, '2023-01-10');

    expect(result.weatherCode.main).toBe('Clouds');
    expect(result.description).toBe('unknown');
  });

  it('returns null values when the archive API omits a daily field', async () => {
    httpClient.get.mockResolvedValueOnce({
      data: {
        daily: {
          time: ['2023-07-15'],
          temperature_2m_max: [30.5],
          temperature_2m_min: [18.2]
          // missing mean, precip, wind, weather_code
        }
      }
    });

    const result = await fetchHistorical(37.78, -122.41, '2023-07-15');

    expect(result.tempMax).toBe(30.5);
    expect(result.tempMin).toBe(18.2);
    expect(result.tempMean).toBeNull();
    expect(result.precipSum).toBeNull();
    expect(result.maxWind).toBeNull();
    expect(result.weatherCode.main).toBe('Clouds');
  });

  it('throws a WeatherError with INVALID_INPUT code for a malformed date', async () => {
    await expect(fetchHistorical(37.78, -122.41, '07/15/2023')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      statusCode: 400
    });
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('throws a WeatherError for an out-of-range calendar date (Feb 30)', async () => {
    await expect(fetchHistorical(37.78, -122.41, '2023-02-30')).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('propagates the raw date string when the API returns no time array', async () => {
    httpClient.get.mockResolvedValueOnce({ data: { daily: {} } });

    const result = await fetchHistorical(37.78, -122.41, '2023-07-15');
    expect(result.date).toBe('2023-07-15');
    expect(result.tempMax).toBeNull();
  });
});
