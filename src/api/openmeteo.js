import httpClient from './http.js';
import { WeatherError, ERROR_CODES } from '../utils/errors.js';
import { wmoToOwm, usAqiToOwmAqi } from './wmoToOwm.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Common informal aliases → ISO 3166-1 alpha-2 (Open-Meteo returns ISO codes)
const COUNTRY_ALIASES = { UK: 'GB' };

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
    if (last.length <= 3 && /^[A-Z]+$/.test(last)) {
      country = COUNTRY_ALIASES[last] || last;
    }
  }
  if (parts.length >= 3) {
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
      `Location "${input}" not found. Please check the spelling or try: "City, Country Code" (e.g., "San Ramon, US")`,
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

export async function fetchForecast(lat, lon, { tempUnit, windUnit }) {
  const res = await httpClient.get(FORECAST_URL, {
    params: {
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
        'cloud_cover'
      ].join(','),
      hourly: [
        'temperature_2m',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'relative_humidity_2m',
        'visibility'
      ].join(','),
      daily: ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset'].join(
        ','
      ),
      timezone: 'auto',
      forecast_days: 6,
      temperature_unit: tempUnit,
      wind_speed_unit: windUnit
    }
  });
  return res.data;
}

export async function fetchAirQuality(lat, lon) {
  try {
    const res = await httpClient.get(AIR_QUALITY_URL, {
      params: { latitude: lat, longitude: lon, current: 'us_aqi' }
    });
    return res.data?.current?.us_aqi ?? null;
  } catch {
    return null;
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

// Build OWM-shaped object from Open-Meteo responses + geocoding result.
// Display layer reads this shape unchanged.
export function normalizeToOwmShape({ place, forecast, usAqi }) {
  const cur = forecast.current || {};
  const hourly = forecast.hourly || {};
  const daily = forecast.daily || {};

  const curWmo = wmoToOwm(cur.weather_code);
  const curIdx = nearestHourlyIndex(hourly.time || [], cur.time);
  const visibilityMeters = hourly.visibility?.[curIdx] ?? 10000;

  const sunriseIso = daily.sunrise?.[0];
  const sunsetIso = daily.sunset?.[0];
  const dt = isoToUnix(cur.time) ?? Math.floor(Date.now() / 1000);

  const list = [];
  const times = hourly.time || [];
  for (let i = 0; i < times.length && list.length < 40; i += 3) {
    const wmo = wmoToOwm(hourly.weather_code?.[i]);
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
      dt_txt: times[i]
    });
  }

  const aqi = usAqiToOwmAqi(usAqi);
  const pollution = aqi !== null ? { list: [{ main: { aqi } }] } : { list: [] };

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
      visibility: visibilityMeters,
      dt
    },
    forecast: { list },
    pollution
  };
}
