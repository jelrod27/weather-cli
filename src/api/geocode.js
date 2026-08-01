import httpClient from './http.js';
import { WeatherError, ERROR_CODES } from '../utils/errors.js';
import { sanitizeForDisplay } from '../utils/validators.js';

/**
 * Geocode module — owns location parsing and result selection.
 *
 * Previously split across locationParser.js (raw CLI words → string) and
 * openmeteo.js (parseLocationQuery + geocode). Two parsers, two seams, one
 * concept. Now one module, one seam: geocode(input) takes raw words or a
 * string and returns {lat, lon, country, admin1}.
 *
 * Re-exports parseLocationQuery and parseLocation for backward compatibility.
 */

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// Common informal aliases → ISO 3166-1 alpha-2 (Open-Meteo returns ISO codes)
const COUNTRY_ALIASES = {
  UK: 'GB',
  USA: 'US',
  UAE: 'AE',
  // Other common 3-letter informal codes
  CAN: 'CA',
  AUS: 'AU',
  BRA: 'BR',
  CHN: 'CN',
  IND: 'IN',
  JPN: 'JP',
  KOR: 'KR',
  RUS: 'RU',
  DEU: 'DE',
  FRA: 'FR',
  ITA: 'IT',
  ESP: 'ES',
  MEX: 'MX',
  ZAF: 'ZA',
  ARG: 'AR',
  NLD: 'NL',
  POL: 'PL',
  TUR: 'TR',
  SAU: 'SA',
  SGP: 'SG',
  HKG: 'HK'
};

// US state codes + DC — recognized as admin1 hints, not country codes.
// Without this, "San Ramon, CA" would treat CA as country code "CA" (Canada)
// instead of California, US.
const US_STATE_CODES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC'
]);

// Canadian province/territory codes — recognized as admin1 for country CA.
const CA_PROVINCE_CODES = new Set([
  'ON',
  'QC',
  'BC',
  'AB',
  'MB',
  'SK',
  'NS',
  'NB',
  'NL',
  'PE',
  'NT',
  'YT',
  'NU'
]);

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

    if (parts.length === 2 && US_STATE_CODES.has(last)) {
      // "San Ramon, CA" → state hint, country defaults to US
      country = 'US';
      admin1 = last;
    } else if (parts.length === 2 && CA_PROVINCE_CODES.has(last)) {
      // "Vancouver, BC" → province hint, country is Canada
      country = 'CA';
      admin1 = last;
    } else if (last.length <= 3 && /^[A-Z]+$/.test(last)) {
      // Generic country code (2 or 3 letters), aliased if informal
      country = COUNTRY_ALIASES[last] || last;
    }
    // If last part is longer than 3 chars, it's not a code — leave country/admin1 null
  }
  if (parts.length >= 3) {
    // "City, State, Country" format — middle part is admin1 hint
    admin1 = parts[1].toUpperCase();
  }

  return { name, country, admin1 };
}

export async function geocode(input) {
  const { name, country, admin1 } = parseLocationQuery(input);

  const res = await httpClient.get(GEOCODING_URL, {
    params: { name, count: 10, language: 'en', format: 'json' }
  });

  const results = res.data?.results;
  if (!Array.isArray(results)) {
    throw new WeatherError(
      `Location service returned unexpected data for "${sanitizeForDisplay(input)}". Please try again.`,
      ERROR_CODES.UPSTREAM_DATA_ERROR,
      502
    );
  }
  if (results.length === 0) {
    throw new WeatherError(
      `Location "${sanitizeForDisplay(input)}" not found. Please check the spelling or try: "City, Country Code" (e.g., "San Ramon, US")`,
      ERROR_CODES.LOCATION_NOT_FOUND,
      404
    );
  }

  let filtered = results;
  if (country) {
    const byCountry = results.filter((r) => r.country_code === country);
    if (byCountry.length > 0) {
      filtered = byCountry;
    } else {
      throw new WeatherError(
        `Location "${sanitizeForDisplay(input)}" not found in country "${country}". Please check the spelling or try: "City, Country Code" (e.g., "San Ramon, US")`,
        ERROR_CODES.LOCATION_NOT_FOUND,
        404
      );
    }
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
