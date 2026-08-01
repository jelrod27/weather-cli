import httpClient from './http.js';
import { wmoToOwm } from './wmoToOwm.js';
import { WeatherError, ERROR_CODES } from '../utils/errors.js';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const DAILY_VARS =
  'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,weather_code';

/**
 * Validate a date string is in YYYY-MM-DD form and is a real calendar date.
 * @param {string} date
 * @returns {boolean}
 */
export function isValidDate(date) {
  if (typeof date !== 'string') return false;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(date)) return false;
  const [y, m, d] = date.split('-').map((p) => Number.parseInt(p, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Fetch historical weather for a single date from the Open-Meteo Archive API.
 * @param {number} lat
 * @param {number} lon
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<object>} normalized historical weather object
 */
export async function fetchHistorical(lat, lon, date) {
  if (!isValidDate(date)) {
    throw new WeatherError(
      `Invalid date "${date}". Expected format: YYYY-MM-DD (e.g. 2023-07-15).`,
      ERROR_CODES.INVALID_INPUT,
      400
    );
  }

  const params = {
    latitude: lat,
    longitude: lon,
    start_date: date,
    end_date: date,
    daily: DAILY_VARS,
    timezone: 'auto'
  };

  const res = await httpClient.get(ARCHIVE_URL, { params });
  const daily = res.data?.daily || {};

  const idx = 0;
  const wmo = wmoToOwm(daily.weather_code?.[idx]);

  return {
    date: daily.time?.[idx] ?? date,
    tempMax: daily.temperature_2m_max?.[idx] ?? null,
    tempMin: daily.temperature_2m_min?.[idx] ?? null,
    tempMean: daily.temperature_2m_mean?.[idx] ?? null,
    precipSum: daily.precipitation_sum?.[idx] ?? null,
    maxWind: daily.wind_speed_10m_max?.[idx] ?? null,
    weatherCode: wmo,
    description: wmo.description
  };
}
