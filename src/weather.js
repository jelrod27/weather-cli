import ora from 'ora';
import { WeatherError, ERROR_CODES } from './utils/errors.js';
import { validateLocation, validateCoordinates, sanitizeForDisplay } from './utils/validators.js';
import {
  geocode,
  fetchForecast,
  fetchAirQuality,
  normalizeToOwmShape,
  getAlerts
} from './api/openmeteo.js';

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

function rethrow(error, locationLabel) {
  const safeLabel = sanitizeForDisplay(locationLabel);
  if (error instanceof WeatherError) return error;

  if (error.response?.status === 404) {
    return new WeatherError(
      `Location "${safeLabel}" not found. Please check the spelling or try: "City, Country Code" (e.g., "San Ramon, US")`,
      ERROR_CODES.LOCATION_NOT_FOUND,
      404
    );
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new WeatherError('Request timed out. Please try again.', ERROR_CODES.NETWORK_ERROR);
  }
  if (error.response?.status === 429) {
    return new WeatherError(error.message, ERROR_CODES.RATE_LIMIT, 429);
  }
  return new WeatherError(`Network error: ${error.message}`, ERROR_CODES.NETWORK_ERROR);
}

async function fetchAndNormalize(
  place,
  userUnits,
  locationLabel,
  { includeMinutely = false } = {}
) {
  const unitSystem = determineDisplayUnits(place.country, userUnits);
  const omUnits = unitsForOpenMeteo(unitSystem);

  try {
    const [forecast, usAqi, alerts] = await Promise.all([
      fetchForecast(place.lat, place.lon, { ...omUnits, includeMinutely }),
      fetchAirQuality(place.lat, place.lon),
      getAlerts(place.lat, place.lon, place.country)
    ]);

    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: usAqi,
      windUnit: omUnits.windUnit,
      alerts
    });
    return {
      ...data,
      displayUnit: unitSystem.display,
      countryCode: place.country
    };
  } catch (error) {
    throw rethrow(error, locationLabel);
  }
}

async function getWeather(location, userUnits = null, options = {}) {
  const validated = validateLocation(location);
  const spinner = ora('Fetching weather data...').start();

  try {
    const place = await geocode(validated);
    const result = await fetchAndNormalize(place, userUnits, location, {
      includeMinutely: options.includeMinutely ?? false
    });
    spinner.succeed(
      `Weather data fetched! Using ${result.displayUnit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius'}${
        place.country ? ` for ${place.country}` : ''
      }`
    );
    return result;
  } catch (error) {
    spinner.fail('Failed to fetch weather data');
    throw rethrow(error, location);
  }
}

async function getWeatherByCoords(lat, lon, userUnits = null, options = {}) {
  const { latitude, longitude } = validateCoordinates(lat, lon);
  const spinner = ora('Fetching weather data...').start();

  // Open-Meteo doesn't offer reverse geocoding; label with the coordinates and
  // skip country-based unit auto-detect. Default to metric unless the user opted in.
  const place = {
    name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    lat: latitude,
    lon: longitude,
    country: '',
    admin1: ''
  };

  try {
    const result = await fetchAndNormalize(place, userUnits, `${lat},${lon}`, {
      includeMinutely: options.includeMinutely ?? false
    });
    spinner.succeed(
      `Weather data fetched! Using ${result.displayUnit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius'}`
    );
    return result;
  } catch (error) {
    spinner.fail('Failed to fetch weather data');
    throw rethrow(error, `${lat},${lon}`);
  }
}

export {
  getWeather,
  getWeatherByCoords,
  determineDisplayUnits,
  convertTemperature,
  celsiusToFahrenheit,
  fahrenheitToCelsius
};
