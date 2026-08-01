import httpClient from './http.js';
import chalk from 'chalk';
import boxen from 'boxen';

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

/**
 * Convert wind/wave direction in degrees to a cardinal direction.
 * @param {number} deg - Direction in degrees
 * @returns {string} Cardinal direction (N, NE, E, SE, S, SW, W, NW) or 'N/A'
 */
export function degToCardinal(deg) {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return 'N/A';
  const d = ((deg % 360) + 360) % 360;
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(d / 45) % 8;
  return cardinals[index];
}

/**
 * Round a numeric field to `digits` decimals, returning null for null/undefined/NaN.
 * @param {number|null|undefined} value
 * @param {number} [digits=1]
 * @returns {number|null}
 */
function fmt(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

/**
 * Fetch marine/ocean data from the Open-Meteo Marine API.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<object|null>} normalized marine object, or null if no data (inland)
 */
export async function fetchMarine(lat, lon) {
  const params = {
    latitude: lat,
    longitude: lon,
    current: [
      'wave_height',
      'wave_direction',
      'wave_period',
      'sea_surface_temperature',
      'ocean_current_velocity'
    ].join(','),
    hourly: ['wave_height', 'wave_direction', 'wave_period', 'sea_surface_temperature'].join(','),
    timezone: 'auto'
  };

  const res = await httpClient.get(MARINE_URL, { params });
  const data = res.data;
  const current = data?.current || {};

  const waveHeight = fmt(current.wave_height, 1);
  const waveDirection =
    current.wave_direction !== null && current.wave_direction !== undefined
      ? Math.round(current.wave_direction)
      : null;
  const wavePeriod = fmt(current.wave_period, 1);
  const seaSurfaceTemp = fmt(current.sea_surface_temperature, 1);
  const oceanCurrentVelocity = fmt(current.ocean_current_velocity, 2);

  // Determine if the location has no marine data (e.g. inland location).
  const noCurrentData =
    waveHeight === null &&
    waveDirection === null &&
    wavePeriod === null &&
    seaSurfaceTemp === null &&
    oceanCurrentVelocity === null;

  if (noCurrentData) {
    return null;
  }

  return {
    waveHeight,
    waveDirection,
    waveDirectionCardinal: waveDirection !== null ? degToCardinal(waveDirection) : 'N/A',
    wavePeriod,
    seaSurfaceTemp,
    oceanCurrentVelocity,
    timezone: data?.timezone || null,
    utc_offset_seconds: data?.utc_offset_seconds ?? null
  };
}

/**
 * Build a formatted chalk/boxen display string for marine data.
 * @param {object} marine - result of fetchMarine (non-null)
 * @param {object} place - geocode result { name, admin1, country, lat, lon }
 * @returns {string} boxen-rendered string
 */
export function displayMarine(marine, place) {
  const locationLabel = place.admin1
    ? `${place.name}, ${place.admin1}, ${place.country}`
    : `${place.name}, ${place.country}`;

  const v = (val, suffix = '') => (val === null || val === undefined ? 'N/A' : `${val}${suffix}`);
  const dir = (deg, cardinal) =>
    deg === null || deg === undefined ? 'N/A' : `${deg}° ${cardinal}`;

  const lines = [
    `${'🌊 Wave Height'.padEnd(24)} ${v(marine.waveHeight, ' m')}`,
    `${'🧭 Wave Direction'.padEnd(24)} ${dir(marine.waveDirection, marine.waveDirectionCardinal)}`,
    `${'⏱️  Wave Period'.padEnd(24)} ${v(marine.wavePeriod, ' s')}`,
    `${'🌡️  Sea Surface Temp'.padEnd(24)} ${v(marine.seaSurfaceTemp, ' °C')}`,
    `${'🔄 Ocean Current'.padEnd(24)} ${v(marine.oceanCurrentVelocity, ' m/s')}`,
    `${'📍 Location'.padEnd(24)} ${locationLabel}`
  ];

  return boxen(lines.join('\n'), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: 0,
    borderStyle: 'round',
    borderColor: 'cyan',
    title: '🌊 Marine Conditions',
    titleAlignment: 'left'
  });
}
