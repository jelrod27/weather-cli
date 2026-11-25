import assert from 'node:assert/strict';
import axios from 'axios';

// Preloaded from the temporary npm install so the CLI keeps its real HTTP
// client and uses fixed provider data without making weather API calls.
axios.defaults.adapter = async ({ url, params }) => {
  switch (url) {
    case 'https://geocoding-api.open-meteo.com/v1/search':
      if (params.name === 'San Ramon CA') return { data: {} };
      assert.equal(params.name, 'San Ramon');
      return {
        data: {
          results: [
            // Return a competing city first to exercise the California state hint.
            {
              name: 'San Ramon',
              latitude: 35.08,
              longitude: -106.65,
              country_code: 'US',
              admin1: 'New Mexico'
            },
            {
              name: 'San Ramon',
              latitude: 37.78,
              longitude: -121.98,
              country_code: 'US',
              admin1: 'California'
            }
          ]
        }
      };
    case 'https://api.open-meteo.com/v1/forecast':
      assert.equal(params.temperature_unit, 'fahrenheit');
      return {
        data: {
          timezone: 'America/Los_Angeles',
          current: { time: 1794240000, temperature_2m: 68, weather_code: 0 },
          hourly: { time: [1794240000], temperature_2m: [71], weather_code: [0] }
        }
      };
    case 'https://air-quality-api.open-meteo.com/v1/air-quality':
      return { data: { current: { us_aqi: 20 } } };
    case 'https://api.weather.gov/alerts/active':
      return { data: { features: [] } };
    default:
      assert.fail(`Unexpected URL in smoke test: ${url}`);
  }
};
