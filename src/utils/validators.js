import { WeatherError, ERROR_CODES } from './errors.js';

const UNSAFE_CHARS_REGEX = /[<>'"{}|\\^`]/g;
// OSC sequences (ESC ] ... BEL|ST) must be stripped before the generic escape
// rule, otherwise their payload survives as plain text.
const OSC_SEQUENCE_REGEX = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g;
// Any remaining escape sequence: CSI, single-character, and orphaned ESC.
const ESCAPE_SEQUENCE_REGEX = /\x1b(?:\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])?/g;
// C0 and C1 control characters — terminals act on all of them.
const CONTROL_CHARS_REGEX = /[\x00-\x1f\x7f-\x9f]/g;
const MAX_LOCATION_LENGTH = 100;

/**
 * Strip terminal control sequences from a string.
 *
 * Applied to every string that reaches the terminal from a remote API — a
 * response carrying escape sequences would otherwise be able to repaint the
 * screen, hide output, or inject content into shell prompts that embed
 * `weather status`.
 *
 * @param {unknown} str
 * @param {{ maxLength?: number }} [options] - optional length clamp
 * @returns {string}
 */
export function stripControlChars(str, { maxLength } = {}) {
  const cleaned = String(str ?? '')
    .replace(OSC_SEQUENCE_REGEX, '')
    .replace(ESCAPE_SEQUENCE_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, '')
    .trim();
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export function sanitizeForDisplay(str) {
  if (typeof str !== 'string') return String(str);
  return stripControlChars(str)
    .replace(UNSAFE_CHARS_REGEX, '')
    .trim()
    .slice(0, MAX_LOCATION_LENGTH);
}

export function sanitizeLocation(location) {
  if (typeof location !== 'string') {
    throw new WeatherError('Location must be a string', ERROR_CODES.INVALID_INPUT);
  }

  return location.replace(UNSAFE_CHARS_REGEX, '').trim().slice(0, MAX_LOCATION_LENGTH);
}

export function validateLocation(location) {
  const sanitized = sanitizeLocation(location);

  if (!sanitized) {
    throw new WeatherError('Location cannot be empty', ERROR_CODES.INVALID_INPUT);
  }

  // Pass the location through as-is. State/country code parsing is handled
  // by parseLocationQuery in src/api/openmeteo.js, which uses the codes as
  // admin1/country hints for the Open-Meteo geocoding API. Rewriting here
  // (e.g. "San Ramon, CA" -> "San Ramon, US") would strip the state-level
  // disambiguation that geocode() relies on.
  return sanitized;
}

export function validateCoordinates(lat, lon) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new WeatherError(
      'Invalid coordinates. Both latitude and longitude must be numbers',
      ERROR_CODES.INVALID_INPUT
    );
  }

  if (latitude < -90 || latitude > 90) {
    throw new WeatherError(
      'Invalid latitude. Must be between -90 and 90',
      ERROR_CODES.INVALID_INPUT
    );
  }

  if (longitude < -180 || longitude > 180) {
    throw new WeatherError(
      'Invalid longitude. Must be between -180 and 180',
      ERROR_CODES.INVALID_INPUT
    );
  }

  return { latitude, longitude };
}

const WATCH_INTERVAL_MIN = 1;
const WATCH_INTERVAL_MAX = 60;
const WATCH_INTERVAL_DEFAULT = 5;

/**
 * Parse the `watch --interval <minutes>` value. Accepts whole minutes from
 * 1 to 60; anything else (non-numeric or out of range) falls back to 5.
 */
export function parseWatchInterval(value) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= WATCH_INTERVAL_MIN && minutes <= WATCH_INTERVAL_MAX
    ? minutes
    : WATCH_INTERVAL_DEFAULT;
}
