import { WeatherError, ERROR_CODES } from './errors.js';

const UNSAFE_CHARS_REGEX = /[<>'"{}|\\^`]/g;
const ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
const MAX_LOCATION_LENGTH = 100;

export function sanitizeForDisplay(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(ANSI_ESCAPE_REGEX, '')
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
