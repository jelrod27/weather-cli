import { WeatherError, ERROR_CODES } from './utils/errors.js';
import { wmoToOwm, usAqiToOwmAqi } from './api/wmoToOwm.js';

/**
 * WeatherReport — the canonical shape that flows from the API layer to the
 * display layer. Every consumer (display.js, status.js, weather.js) reads
 * this shape instead of raw Open-Meteo or OWM key paths.
 *
 * This module owns the shape. openmeteo.js builds one via normalizeToOwmShape;
 * display.js and status.js consume one. The OWM-compatibility shape is an
 * implementation detail of the adapter, not a contract callers memorize.
 *
 * Shape:
 *   {
 *     current: { name, coord, sys, main, wind, weather, uv_index,
 *               visibility, dew_point, cloud_cover, cape, solar_radiation,
 *               precip_probability, pressure_trend, dt },
 *     forecast: { list: [{ dt, main, weather, wind, aqi, dt_txt }] },
 *     pollution: { list: [{ main: { aqi } }] },
 *     dailyAqi: { <dateString>: <1-5> },
 *     windUnit, alerts, minutely, timezone,
 *     displayUnit, countryCode   // added by weather.js after normalization
 *   }
 */

function isoToUnix(iso) {
  if (!iso) return null;
  // If already a Unix timestamp (number in seconds), pass through
  if (typeof iso === 'number') return iso;
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

// Build a WeatherReport object from Open-Meteo responses + geocoding result.
// The display layer reads this shape unchanged.
export function normalizeToOwmShape({ place, forecast, airQuality, windUnit = 'ms', alerts = [] }) {
  if (!forecast || typeof forecast !== 'object') {
    throw new WeatherError(
      'Forecast data is missing or malformed from the weather provider.',
      ERROR_CODES.UPSTREAM_DATA_ERROR,
      502
    );
  }

  const cur = forecast.current || {};
  const hourly = forecast.hourly || {};
  const daily = forecast.daily || {};

  const timezone = forecast.timezone || null;

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
      cape: cur.cape ?? null,
      solar_radiation: hourly.shortwave_radiation?.[curIdx] ?? null,
      precip_probability: daily.precipitation_probability?.[0],
      pressure_trend: pressureTrend,
      dt
    },
    forecast: { list },
    pollution,
    dailyAqi: dailyAqiMap,
    windUnit,
    alerts,
    minutely,
    timezone
  };
}
