import httpClient from './http.js';
import { WeatherError, ERROR_CODES } from '../utils/errors.js';
import { sanitizeForDisplay } from '../utils/validators.js';
import { fetchAlerts, sortAlerts } from './alerts.js';

// normalizeToOwmShape now lives in weatherReport.js — the WeatherReport shape
// is the canonical interface between API and display layers.
export { normalizeToOwmShape } from '../weatherReport.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Common informal aliases → ISO 3166-1 alpha-2 (Open-Meteo returns ISO codes)
const COUNTRY_ALIASES = {
  UK: 'GB',
  USA: 'US',
  UAE: 'AE',
  // Other common 3-letter informal codes
  CAN: 'CA',
  AUS: 'AU',
  BRA: 'BR',
  CHN: 'CN',
  IND: 'IN',
  JPN: 'JP',
  KOR: 'KR',
  RUS: 'RU',
  DEU: 'DE',
  FRA: 'FR',
  ITA: 'IT',
  ESP: 'ES',
  MEX: 'MX',
  ZAF: 'ZA',
  ARG: 'AR',
  NLD: 'NL',
  POL: 'PL',
  TUR: 'TR',
  SAU: 'SA',
  SGP: 'SG',
  HKG: 'HK'
};

// US state codes + DC — recognized as admin1 hints, not country codes.
// Without this, "San Ramon, CA" would treat CA as country code "CA" (Canada)
// instead of California, US.
const US_STATE_CODES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC'
]);

// Canadian province/territory codes — recognized as admin1 for country CA.
const CA_PROVINCE_CODES = new Set([
  'ON',
  'QC',
  'BC',
  'AB',
  'MB',
  'SK',
  'NS',
  'NB',
  'NL',
  'PE',
  'NT',
  'YT',
  'NU'
]);

export function parseLocationQuery(input) {
  const parts = input
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const name = parts[0] || input.trim();
  let country = null;
  let admin1 = null;

  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toUpperCase();

    if (parts.length === 2 && US_STATE_CODES.has(last)) {
      // "San Ramon, CA" → state hint, country defaults to US
      country = 'US';
      admin1 = last;
    } else if (parts.length === 2 && CA_PROVINCE_CODES.has(last)) {
      // "Vancouver, BC" → province hint, country is Canada
      country = 'CA';
      admin1 = last;
    } else if (last.length <= 3 && /^[A-Z]+$/.test(last)) {
      // Generic country code (2 or 3 letters), aliased if informal
      country = COUNTRY_ALIASES[last] || last;
    }
    // If last part is longer than 3 chars, it's not a code — leave country/admin1 null
  }
  if (parts.length >= 3) {
    // "City, State, Country" format — middle part is admin1 hint
    admin1 = parts[1].toUpperCase();
  }

  return { name, country, admin1 };
}

export async function geocode(input) {
  const { name, country, admin1 } = parseLocationQuery(input);

  const res = await httpClient.get(GEOCODING_URL, {
    params: { name, count: 10, language: 'en', format: 'json' }
  });

  const results = res.data?.results || [];
  if (results.length === 0) {
    throw new WeatherError(
      `Location "${sanitizeForDisplay(input)}" not found. Please check the spelling or try: "City, Country Code" (e.g., "San Ramon, US")`,
      ERROR_CODES.LOCATION_NOT_FOUND,
      404
    );
  }

  let filtered = results;
  if (country) {
    const byCountry = results.filter((r) => r.country_code === country);
    if (byCountry.length > 0) filtered = byCountry;
  }
  if (admin1) {
    const byAdmin = filtered.filter((r) => {
      const code = (r.admin1_code || '').toUpperCase();
      const full = (r.admin1 || '').toUpperCase();
      return code === admin1 || full.startsWith(admin1);
    });
    if (byAdmin.length > 0) filtered = byAdmin;
  }

  const top = filtered[0];
  return {
    name: top.name,
    lat: top.latitude,
    lon: top.longitude,
    country: top.country_code || '',
    admin1: top.admin1 || ''
  };
}

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
