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

  // Allow locations with or without commas
  // If it has a comma, ensure state/country code is 2 letters
  if (sanitized.includes(',')) {
    const parts = sanitized.split(',').map((p) => p.trim());
    if (parts.length === 2) {
      const [city, stateOrCountry] = parts;
      // Convert state codes to country codes for OpenWeatherMap
      // CA (California) -> US, etc.
      const stateToCountry = {
        AL: 'US',
        AK: 'US',
        AZ: 'US',
        AR: 'US',
        CA: 'US',
        CO: 'US',
        CT: 'US',
        DE: 'US',
        FL: 'US',
        GA: 'US',
        HI: 'US',
        ID: 'US',
        IL: 'US',
        IN: 'US',
        IA: 'US',
        KS: 'US',
        KY: 'US',
        LA: 'US',
        ME: 'US',
        MD: 'US',
        MA: 'US',
        MI: 'US',
        MN: 'US',
        MS: 'US',
        MO: 'US',
        MT: 'US',
        NE: 'US',
        NV: 'US',
        NH: 'US',
        NJ: 'US',
        NM: 'US',
        NY: 'US',
        NC: 'US',
        ND: 'US',
        OH: 'US',
        OK: 'US',
        OR: 'US',
        PA: 'US',
        RI: 'US',
        SC: 'US',
        SD: 'US',
        TN: 'US',
        TX: 'US',
        UT: 'US',
        VT: 'US',
        VA: 'US',
        WA: 'US',
        WV: 'US',
        WI: 'US',
        WY: 'US'
      };

      const upperStateOrCountry = stateOrCountry.toUpperCase();
      if (stateToCountry[upperStateOrCountry]) {
        // It's a US state code, convert to country format
        return `${city}, ${stateToCountry[upperStateOrCountry]}`;
      }
    }
  }

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
