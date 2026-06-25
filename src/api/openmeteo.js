import httpClient from './http.js';
import { WeatherError, ERROR_CODES } from '../utils/errors.js';
import { sanitizeForDisplay } from '../utils/validators.js';
import { wmoToOwm, usAqiToOwmAqi } from './wmoToOwm.js';
import { fetchAlerts, sortAlerts } from './alerts.js';

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
      'dew_point_2m'
    ].join(','),
    hourly: [
      'temperature_2m',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'relative_humidity_2m',
      'pressure_msl',
      'visibility'
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

function isoToUnix(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function nearestHourlyIndex(times, refIso) {
  if (!Array.isArray(times) || times.length === 0) return 0;
  const ref = new Date(refIso).getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - ref);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
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

// Build OWM-shaped object from Open-Meteo responses + geocoding result.
// Display layer reads this shape unchanged.
export function normalizeToOwmShape({ place, forecast, airQuality, windUnit = 'ms', alerts = [] }) {
  const cur = forecast.current || {};
  const hourly = forecast.hourly || {};
  const daily = forecast.daily || {};

  const curWmo = wmoToOwm(cur.weather_code);
  const curIdx = nearestHourlyIndex(hourly.time || [], cur.time);
  const visibilityMeters = hourly.visibility?.[curIdx] ?? 10000;
  // Compute barometric pressure trend (3-hour tendency)
  const curPressure = cur.pressure_msl ?? null;
  const hourlyPressures = hourly.pressure_msl || [];
  let pressureTrend = null;
  if (
    curPressure !== null &&
    curIdx >= 3 &&
    hourlyPressures[curIdx - 3] !== null &&
    hourlyPressures[curIdx - 3] !== undefined &&
    !Number.isNaN(hourlyPressures[curIdx - 3])
  ) {
    const pressure3hAgo = hourlyPressures[curIdx - 3];
    const delta = Math.round((curPressure - pressure3hAgo) * 10) / 10;
    const trend = delta > 0.5 ? 'rising' : delta < -0.5 ? 'falling' : 'steady';
    pressureTrend = { trend, delta, pressure_3h_ago: pressure3hAgo };
  }

  const sunriseIso = daily.sunrise?.[0];
  const sunsetIso = daily.sunset?.[0];
  const dt = isoToUnix(cur.time) ?? Math.floor(Date.now() / 1000);

  // Air quality data
  const aqCurrent = airQuality.current; // raw US AQI number or null
  const aqHourlyTimes = airQuality.hourly?.time || [];
  const aqHourlyValues = airQuality.hourly?.us_aqi || [];
  const aqDailyTimes = airQuality.daily?.time || [];
  const aqDailyValues = airQuality.daily?.us_aqi || [];

  // Build a map of date string → daily AQI (OWM 1-5 scale)
  const dailyAqiMap = {};
  for (let d = 0; d < aqDailyTimes.length && d < aqDailyValues.length; d++) {
    const aqi = usAqiToOwmAqi(aqDailyValues[d]);
    const dateKey = new Date(aqDailyTimes[d] + 'T12:00:00').toDateString();
    dailyAqiMap[dateKey] = aqi;
  }

  const list = [];
  const times = hourly.time || [];
  // Open-Meteo hourly starts at 00:00 local with no past_days, so times[0] is
  // midnight today. Align to the next 3-hour boundary at or after the current
  // hour so the list mirrors OWM's future-only 3-hour periods.
  const startIdx = Math.ceil(curIdx / 3) * 3;
  for (let i = startIdx; i < times.length && list.length < 40; i += 3) {
    const wmo = wmoToOwm(hourly.weather_code?.[i]);
    // Find the nearest hourly AQI sample for this 3-hour period
    let periodAqi = null;
    for (let j = i; j < i + 3 && j < aqHourlyTimes.length; j++) {
      if (
        aqHourlyTimes[j] === times[i] &&
        aqHourlyValues[j] !== null &&
        aqHourlyValues[j] !== undefined
      ) {
        periodAqi = usAqiToOwmAqi(aqHourlyValues[j]);
        break;
      }
    }
    if (periodAqi === null) {
      // Fallback: scan a small window around the target index
      for (let offset = 0; offset < 3; offset++) {
        const j = i + offset;
        if (
          j < aqHourlyValues.length &&
          aqHourlyValues[j] !== null &&
          aqHourlyValues[j] !== undefined
        ) {
          periodAqi = usAqiToOwmAqi(aqHourlyValues[j]);
          break;
        }
      }
    }
    list.push({
      dt: isoToUnix(times[i]),
      main: {
        temp: hourly.temperature_2m?.[i] ?? cur.temperature_2m,
        temp_min: hourly.temperature_2m?.[i] ?? cur.temperature_2m,
        temp_max: hourly.temperature_2m?.[i] ?? cur.temperature_2m,
        humidity: hourly.relative_humidity_2m?.[i] ?? cur.relative_humidity_2m,
        pressure: cur.pressure_msl ?? 1013
      },
      weather: [wmo],
      wind: {
        speed: hourly.wind_speed_10m?.[i] ?? cur.wind_speed_10m ?? 0,
        deg: hourly.wind_direction_10m?.[i] ?? cur.wind_direction_10m ?? 0
      },
      aqi: periodAqi,
      dt_txt: times[i]
    });
  }

  const aqi = usAqiToOwmAqi(aqCurrent);
  const pollution = aqi !== null ? { list: [{ main: { aqi } }] } : { list: [] };

  // Minutely-15 precipitation data (for radar command)
  const minutely = forecast.minutely_15 || {};

  return {
    current: {
      name: place.name,
      coord: { lat: place.lat, lon: place.lon },
      sys: {
        country: place.country,
        sunrise: isoToUnix(sunriseIso),
        sunset: isoToUnix(sunsetIso)
      },
      main: {
        temp: cur.temperature_2m,
        feels_like: cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        pressure: cur.pressure_msl,
        temp_min: daily.temperature_2m_min?.[0] ?? cur.temperature_2m,
        temp_max: daily.temperature_2m_max?.[0] ?? cur.temperature_2m
      },
      wind: {
        speed: cur.wind_speed_10m ?? 0,
        deg: cur.wind_direction_10m ?? 0,
        gust: cur.wind_gusts_10m
      },
      weather: [curWmo],
      uv_index: cur.uv_index,
      visibility: visibilityMeters,
      dew_point: cur.dew_point_2m,
      cloud_cover: cur.cloud_cover,
      precip_probability: daily.precipitation_probability?.[0],
      pressure_trend: pressureTrend,
      dt
    },
    forecast: { list },
    pollution,
    dailyAqi: dailyAqiMap,
    windUnit,
    alerts,
    minutely
  };
}
