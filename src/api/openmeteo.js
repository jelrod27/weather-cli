import httpClient from './http.js';
import { fetchAlerts, sortAlerts } from './alerts.js';

// normalizeToOwmShape now lives in weatherReport.js — the WeatherReport shape
// is the canonical interface between API and display layers.
export { normalizeToOwmShape } from '../weatherReport.js';

// geocode and parseLocationQuery now live in geocode.js — one module owns
// location parsing and result selection. Re-exported for backward compatibility.
export { geocode, parseLocationQuery } from './geocode.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export async function fetchForecast(lat, lon, { tempUnit, windUnit, includeMinutely = false }) {
  const params = {
    latitude: lat,
    longitude: lon,
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'pressure_msl',
      'weather_code',
      'is_day',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'cloud_cover',
      'uv_index',
      'dew_point_2m',
      'cape'
    ].join(','),
    hourly: [
      'temperature_2m',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'relative_humidity_2m',
      'pressure_msl',
      'visibility',
      'shortwave_radiation'
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'sunrise',
      'sunset',
      'precipitation_probability'
    ].join(','),
    timezone: 'auto',
    forecast_days: 6,
    temperature_unit: tempUnit,
    wind_speed_unit: windUnit
  };

  if (includeMinutely) {
    params.minutely_15 = 'precipitation';
  }

  const res = await httpClient.get(FORECAST_URL, { params });
  return res.data;
}

export async function fetchAirQuality(lat, lon) {
  try {
    const res = await httpClient.get(AIR_QUALITY_URL, {
      params: {
        latitude: lat,
        longitude: lon,
        current: 'us_aqi',
        hourly: 'us_aqi',
        timezone: 'auto'
      }
    });
    const hourly = res.data?.hourly || {};
    // Derive daily AQI from hourly averages (API has no daily US AQI variable)
    const daily = { time: [], us_aqi: [] };
    const hTimes = hourly.time || [];
    const hVals = hourly.us_aqi || [];
    if (hTimes.length > 0) {
      const dayBuckets = {};
      for (let i = 0; i < hTimes.length && i < hVals.length; i++) {
        const dayKey = hTimes[i].slice(0, 10); // YYYY-MM-DD
        if (!dayBuckets[dayKey]) dayBuckets[dayKey] = [];
        if (hVals[i] !== null && hVals[i] !== undefined) {
          dayBuckets[dayKey].push(hVals[i]);
        }
      }
      for (const [day, vals] of Object.entries(dayBuckets)) {
        daily.time.push(day);
        daily.us_aqi.push(
          vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
        );
      }
    }
    return {
      current: res.data?.current?.us_aqi ?? null,
      hourly,
      daily
    };
  } catch {
    return { current: null, hourly: {}, daily: {} };
  }
}

/**
 * Fetch and sort weather alerts for a location.
 * @param {number} lat
 * @param {number} lon
 * @param {string} countryCode
 * @returns {Promise<Array>} Sorted alert array
 */
export async function getAlerts(lat, lon, countryCode) {
  const alerts = await fetchAlerts(lat, lon, countryCode);
  return sortAlerts(alerts);
}
