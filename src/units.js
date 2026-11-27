/**
 * Units module — owns all temperature and wind unit logic.
 *
 * Previously scattered across weather.js (celsiusToFahrenheit,
 * determineDisplayUnits, unitsForOpenMeteo), display.js (formatFeelsLike
 * re-implementing conversion), and config.js (processTemperatureOptions).
 * Now one module, one seam.
 *
 * Re-exported from weather.js and config.js for backward compatibility.
 */

import { WeatherError, ERROR_CODES } from './utils/errors.js';

// Regional temperature units mapping (US + a handful of US-aligned territories)
const FAHRENHEIT_COUNTRIES = new Set(['US', 'USA', 'BS', 'BZ', 'KY', 'PW']);

// Temperature conversion utilities
function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

function fahrenheitToCelsius(fahrenheit) {
  return ((fahrenheit - 32) * 5) / 9;
}

function getRegionalTempUnit(countryCode) {
  return FAHRENHEIT_COUNTRIES.has(countryCode?.toUpperCase()) ? 'fahrenheit' : 'celsius';
}

function convertTemperature(temp, fromUnit, toUnit) {
  if (fromUnit === toUnit) return temp;
  if (fromUnit === 'celsius' && toUnit === 'fahrenheit') return celsiusToFahrenheit(temp);
  if (fromUnit === 'fahrenheit' && toUnit === 'celsius') return fahrenheitToCelsius(temp);
  return temp;
}

function determineDisplayUnits(countryCode, userPreference = null) {
  if (userPreference === 'fahrenheit' || userPreference === 'imperial') {
    return { api: 'imperial', display: 'fahrenheit' };
  }
  if (userPreference === 'celsius' || userPreference === 'metric') {
    return { api: 'metric', display: 'celsius' };
  }
  const regionalUnit = getRegionalTempUnit(countryCode);
  return {
    api: regionalUnit === 'fahrenheit' ? 'imperial' : 'metric',
    display: regionalUnit
  };
}

function unitsForOpenMeteo(unitSystem) {
  return unitSystem.api === 'imperial'
    ? { tempUnit: 'fahrenheit', windUnit: 'mph' }
    : { tempUnit: 'celsius', windUnit: 'ms' };
}

/**
 * Parse CLI temperature options into a unit preference string.
 * Returns 'celsius', 'fahrenheit', or null (auto-detect).
 */
function processTemperatureOptions(options) {
  if (options.celsius) return 'celsius';
  if (options.fahrenheit) return 'fahrenheit';
  switch (options.units) {
    case 'metric':
    case 'celsius':
      return 'celsius';
    case 'imperial':
    case 'fahrenheit':
      return 'fahrenheit';
    case undefined:
    case 'auto':
      return null;
    default:
      throw new WeatherError(
        'Invalid units. Choose auto, metric, imperial, celsius, or fahrenheit.',
        ERROR_CODES.INVALID_INPUT
      );
  }
}

export {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  convertTemperature,
  determineDisplayUnits,
  unitsForOpenMeteo,
  processTemperatureOptions
};
