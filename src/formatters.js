import chalk from 'chalk';

/**
 * Pure formatting functions for weather data display.
 *
 * These are the internal implementation of the display module — callers should
 * use the high-level render functions from display.js (renderCurrent,
 * render5Day, render24Hour, renderRadar, renderStatusLine) rather than
 * importing formatters directly.
 *
 * Re-exported from display.js for backward compatibility with existing tests
 * and any external consumers that import individual formatters.
 */

function formatTemp(temp, displayUnit, options = {}) {
  if (temp === null || temp === undefined || Number.isNaN(temp)) return 'N/A';
  const unit = displayUnit === 'fahrenheit' ? '°F' : '°C';
  const rounded = Math.round(temp);
  const tempString = `${rounded}${unit}`;

  if (options.colorCode) {
    if (options.type === 'max') return chalk.red(tempString);
    if (options.type === 'min') return chalk.blue(tempString);
    if (options.type === 'current') return chalk.yellow(tempString);
  }

  return tempString;
}

function formatFeelsLike(temp, displayUnit) {
  if (temp === null || temp === undefined || Number.isNaN(temp)) return 'N/A';
  if (displayUnit === 'fahrenheit') {
    const f = Math.round(temp);
    const c = Math.round(((temp - 32) * 5) / 9);
    return `${f}°F / ${c}°C`;
  }
  const c = Math.round(temp);
  const f = Math.round((temp * 9) / 5 + 32);
  return `${c}°C / ${f}°F`;
}

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Convert wind degrees to a cardinal direction.
 * @param {number} deg - Wind direction in degrees
 * @returns {string} Cardinal direction (N, NE, E, SE, S, SW, W, NW)
 */
function degToCardinal(deg) {
  const d = ((deg % 360) + 360) % 360;
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(d / 45) % 8;
  return cardinals[index];
}

/**
 * Return a short relative-time string like "in 3h 22m", "in 45m", "22m ago".
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string}
 */
function formatRelativeTime(timestamp) {
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = timestamp - nowSec;
  // Treat tiny negative diffs (timing noise) as zero
  const absDiff = Math.abs(diff < 0 && diff > -60 ? 0 : diff);

  const hours = Math.floor(absDiff / 3600);
  const mins = Math.floor((absDiff % 3600) / 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || hours === 0) parts.push(`${mins}m`);

  const relStr = parts.join(' ');
  if (diff >= 0 || (diff < 0 && diff > -60)) {
    return `in ${relStr}`;
  }
  return `${relStr} ago`;
}

function formatWindSpeed(speed, displayUnit, windUnit) {
  if (windUnit === 'mph') {
    // API already returned mph — no conversion needed
    return `${speed.toFixed(1)} mph`;
  }
  if (displayUnit === 'fahrenheit') {
    // API returned m/s, convert to mph
    const mph = speed * 2.237;
    return `${mph.toFixed(1)} mph`;
  }
  return `${speed.toFixed(1)} m/s`;
}

function formatVisibility(meters, displayUnit) {
  if (displayUnit === 'fahrenheit') {
    const miles = meters / 1609.344;
    return `${miles.toFixed(1)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Format dew point value with NOAA comfort level label.
 * @param {number|null|undefined} value - Dew point in Celsius
 * @param {string} displayUnit - 'celsius' or 'fahrenheit'
 * @returns {string} Formatted string like "54°F (Dry)" or "N/A"
 */
function formatDewPoint(value, displayUnit) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const celsius = value;
  let comfort;
  if (celsius < 12.8) comfort = 'Dry';
  else if (celsius < 15.6) comfort = 'Comfortable';
  else if (celsius < 18.3) comfort = 'Sticky';
  else if (celsius < 21.1) comfort = 'Uncomfortable';
  else if (celsius < 23.9) comfort = 'Oppressive';
  else comfort = 'Severe';

  if (displayUnit === 'fahrenheit') {
    const fahrenheit = Math.round((celsius * 9) / 5 + 32);
    return `${fahrenheit}°F (${comfort})`;
  }
  return `${Math.round(celsius)}°C (${comfort})`;
}

/**
 * Format CAPE (convective available potential energy) value with thunderstorm risk label.
 * @param {number|null|undefined} value - CAPE in J/kg
 * @returns {string} Formatted string like "1500 J/kg (moderate)" or "N/A"
 */
function formatCape(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const v = Math.round(value);
  if (v < 0) return '0 J/kg (none)';
  if (v < 1000) return chalk.gray(`${v} J/kg (low)`);
  if (v < 2500) return chalk.yellow(`${v} J/kg (moderate)`);
  if (v < 4000) return chalk.red(`${v} J/kg (high)`);
  return chalk.red(`${v} J/kg (extreme)`);
}

/**
 * Format solar radiation value with intensity label.
 * @param {number|null|undefined} value - Solar irradiance in W/m2
 * @returns {string} Formatted string like "500 W/m2 (strong)" or "N/A"
 */
function formatSolarRadiation(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const v = Math.round(value);
  if (v === 0) return '0 W/m2 (night)';
  if (v < 100) return chalk.gray(`${v} W/m2 (weak)`);
  if (v < 300) return `${v} W/m2 (moderate)`;
  if (v < 600) return `${v} W/m2 (strong)`;
  if (v < 1000) return `${v} W/m2 (very strong)`;
  return chalk.red(`${v} W/m2 (extreme)`);
}

function createDataRow(label, value, options = {}) {
  const { labelWidth = 20, icon = '' } = options;
  const formattedLabel = icon ? `${icon} ${label}` : label;
  return `${formattedLabel.padEnd(labelWidth)} ${value}`;
}

function getAirQualityDescription(aqi) {
  const descriptions = {
    1: { text: 'Good', color: chalk.green },
    2: { text: 'Fair', color: chalk.greenBright },
    3: { text: 'Moderate', color: chalk.yellow },
    4: { text: 'Poor', color: chalk.red },
    5: { text: 'Very Poor', color: chalk.magenta }
  };
  const desc = descriptions[aqi] || { text: 'Unknown', color: chalk.gray };
  return desc.color(desc.text);
}

/**
 * Format UV index value with WHO risk level label.
 * @param {number|null|undefined} value - UV index value
 * @returns {string} Formatted string like "7.4 (High)" or "N/A"
 */
function formatUvIndex(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  if (value < 3) return `${value} (Low)`;
  if (value < 6) return `${value} (Moderate)`;
  if (value < 8) return `${value} (High)`;
  if (value < 11) return `${value} (Very High)`;
  return `${value} (Extreme)`;
}

/**
 * Format precipitation probability value.
 * @param {number|null|undefined} value - Precipitation probability (0-100)
 * @returns {string} Formatted value or "N/A"
 */
function formatPrecipProbability(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return String(value);
}

/**
 * Format wind speed as a Beaufort scale description.
 * @param {number|null|undefined} speed - Wind speed
 * @param {string} windUnit - 'ms', 'mph', or 'kn'
 * @returns {string} Beaufort description or "N/A"
 */
function formatWindDescription(speed, windUnit) {
  if (speed === null || speed === undefined || Number.isNaN(speed)) return 'N/A';
  let ms = speed;
  if (windUnit === 'mph') ms = speed * 0.44704;
  else if (windUnit === 'kn') ms = speed * 0.51444;
  if (ms < 0.5) return 'Calm';
  if (ms < 1.5) return 'Light air';
  if (ms < 3.3) return 'Light breeze';
  if (ms < 5.5) return 'Gentle breeze';
  if (ms < 7.9) return 'Moderate breeze';
  if (ms < 10.7) return 'Fresh breeze';
  if (ms < 13.8) return 'Strong breeze';
  if (ms < 17.1) return 'High wind';
  if (ms < 20.7) return 'Gale';
  if (ms < 24.4) return 'Strong gale';
  if (ms < 28.4) return 'Storm';
  if (ms < 32.6) return 'Violent storm';
  return 'Hurricane';
}

/**
 * Format daylight duration from sunrise and sunset timestamps.
 * @param {number|null|undefined} sunrise - Unix timestamp (seconds)
 * @param {number|null|undefined} sunset - Unix timestamp (seconds)
 * @returns {string} Duration like "14h 22m" or "N/A"
 */
function formatDaylight(sunrise, sunset) {
  if (sunrise === null || sunrise === undefined || Number.isNaN(sunrise)) return 'N/A';
  if (sunset === null || sunset === undefined || Number.isNaN(sunset)) return 'N/A';
  const diff = sunset - sunrise;
  if (diff < 0) return 'N/A';
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatPressureTrend(trend, delta) {
  if (trend === null || trend === undefined) return '';
  if (trend === 'rising') return chalk.blue(`(↑ +${Math.abs(delta).toFixed(1)})`);
  if (trend === 'falling') return chalk.red(`(↓ -${Math.abs(delta).toFixed(1)})`);
  return chalk.gray(`(→ ±${Math.abs(delta).toFixed(1)})`);
}

function formatMoonPhase(moonData) {
  if (!moonData) return 'N/A';
  return `${moonData.emoji} ${moonData.name} (${moonData.illumination}% illuminated)`;
}

/** Return the most frequent value in an array of numbers. */
function modeValue(arr) {
  const counts = {};
  let maxCount = 0;
  let result = arr[0];
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      result = v;
    }
  }
  return result;
}

function getTerminalWidth() {
  return process.stdout.columns || 80;
}

// Strip ANSI escape codes so padEnd uses visible width
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function visibleLength(str) {
  return str.replace(ANSI_RE, '').length;
}
function padVisible(str, width) {
  const pad = Math.max(0, width - visibleLength(str));
  return str + ' '.repeat(pad);
}

function renderTwoColumnRows(leftCol, rightCol, leftWidth) {
  const rows = [];
  const height = Math.max(leftCol.length, rightCol.length);
  for (let i = 0; i < height; i++) {
    const l = leftCol[i] || '';
    const r = rightCol[i] || '';
    rows.push(r ? `${padVisible(l, leftWidth)}  ${r}` : l);
  }
  return rows.join('\n');
}

/**
 * Map severity to chalk color function.
 */
function severityColor(severity) {
  switch (severity) {
    case 'Extreme':
      return chalk.red.bold;
    case 'Severe':
      return chalk.red;
    case 'Moderate':
      return chalk.yellow;
    case 'Minor':
      return chalk.yellow.dim;
    default:
      return chalk.white;
  }
}

/**
 * Map severity to boxen border color.
 */
function severityBorderColor(severity) {
  switch (severity) {
    case 'Extreme':
    case 'Severe':
      return 'red';
    case 'Moderate':
      return 'yellow';
    default:
      return 'gray';
  }
}

export {
  formatTemp,
  formatFeelsLike,
  formatWindSpeed,
  formatVisibility,
  formatTime,
  formatRelativeTime,
  degToCardinal,
  getAirQualityDescription,
  formatUvIndex,
  formatDewPoint,
  formatPrecipProbability,
  formatWindDescription,
  formatDaylight,
  formatPressureTrend,
  formatMoonPhase,
  formatCape,
  formatSolarRadiation,
  createDataRow,
  modeValue,
  getTerminalWidth,
  visibleLength,
  padVisible,
  renderTwoColumnRows,
  severityColor,
  severityBorderColor
};
