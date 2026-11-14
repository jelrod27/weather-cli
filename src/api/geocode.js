import httpClient from './http.js';
import { WeatherError, ERROR_CODES } from '../utils/errors.js';
import { sanitizeForDisplay, stripControlChars } from '../utils/validators.js';

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

// Only recognized country codes may be stripped from an unpunctuated city
// name. In particular, ordinary three-letter words such as "Lat" stay intact.
const COUNTRY_CODES = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
    'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
    'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' ')
);

// US state codes + DC — recognized as admin1 hints, not country codes.
// Without this, "San Ramon, CA" would treat CA as country code "CA" (Canada)
// instead of California, US.
const US_STATES = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia'
};

// Canadian province/territory codes — recognized as admin1 for country CA.
const CA_PROVINCES = {
  ON: 'Ontario',
  QC: 'Quebec',
  BC: 'British Columbia',
  AB: 'Alberta',
  MB: 'Manitoba',
  SK: 'Saskatchewan',
  NS: 'Nova Scotia',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  PE: 'Prince Edward Island',
  NT: 'Northwest Territories',
  YT: 'Yukon',
  NU: 'Nunavut'
};

function normalizePlaceName(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function splitLocationParts(input) {
  const parts = input
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  // Commas already provide explicit city/admin/country boundaries.
  if (parts.length !== 1) return parts;

  const words = parts[0].split(/\s+/);
  if (words.length < 2) return parts;

  const last = words.at(-1).toUpperCase();
  const country = COUNTRY_ALIASES[last] || (COUNTRY_CODES.has(last) ? last : null);
  const previous = words.at(-2).toUpperCase();

  // An explicit country disambiguates overlapping codes: "Toronto ON CA"
  // means Ontario, Canada; "San Ramon CA US" means California, US.
  if (
    words.length >= 3 &&
    ((country === 'US' && Object.hasOwn(US_STATES, previous)) ||
      (country === 'CA' && Object.hasOwn(CA_PROVINCES, previous)))
  ) {
    return [words.slice(0, -2).join(' '), previous, last];
  }

  if (Object.hasOwn(US_STATES, last) || Object.hasOwn(CA_PROVINCES, last) || country) {
    return [words.slice(0, -1).join(' '), last];
  }
  return parts;
}

export function parseLocationQuery(input) {
  const parts = splitLocationParts(input);
  const name = parts[0] || input.trim();
  let country = null;
  let admin1 = null;

  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toUpperCase();

    if (parts.length === 2 && Object.hasOwn(US_STATES, last)) {
      // "San Ramon, CA" → state hint, country defaults to US
      country = 'US';
      admin1 = last;
    } else if (parts.length === 2 && Object.hasOwn(CA_PROVINCES, last)) {
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

async function searchLocations(name, input, { optional = false } = {}) {
  const res = await httpClient.get(GEOCODING_URL, {
    params: { name, count: 10, language: 'en', format: 'json' }
  });

  const results = res.data?.results;
  // Open-Meteo omits results for a query with no matches. That is expected
  // for the preliminary full-input lookup before trying inferred suffixes.
  if (
    optional &&
    results === undefined &&
    res.data &&
    typeof res.data === 'object' &&
    !Array.isArray(res.data)
  ) {
    return [];
  }
  if (!Array.isArray(results)) {
    throw new WeatherError(
      `Location service returned unexpected data for "${sanitizeForDisplay(input)}". Please try again.`,
      ERROR_CODES.UPSTREAM_DATA_ERROR,
      502
    );
  }
  return results;
}

export async function geocode(input) {
  const query = parseLocationQuery(input);
  const { name } = query;
  let { country, admin1 } = query;
  let results;

  // A final word that resembles a code may belong to the city itself
  // ("Sa Pa", "Mae On", "Yen My"). Prefer exact full-name matches before
  // applying inferred suffixes; commas make those hints explicit.
  if (!input.includes(',') && (country || admin1)) {
    const candidates = await searchLocations(input.trim(), input, { optional: true });
    const exact = candidates.filter(
      (r) => normalizePlaceName(r.name) === normalizePlaceName(input)
    );
    if (exact.length > 0) {
      results = exact;
      country = null;
      admin1 = null;
    }
  }

  results ??= await searchLocations(name, input);
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
    const regions = country === 'US' ? US_STATES : country === 'CA' ? CA_PROVINCES : {};
    const regionName = regions[admin1] || admin1;
    const byAdmin = filtered.filter((r) => {
      const code = (r.admin1_code || '').toUpperCase();
      return code === admin1 || normalizePlaceName(r.admin1) === normalizePlaceName(regionName);
    });
    if (byAdmin.length === 0) {
      throw new WeatherError(
        `Location "${sanitizeForDisplay(input)}" not found in region "${sanitizeForDisplay(admin1)}". Please check the city and region.`,
        ERROR_CODES.LOCATION_NOT_FOUND,
        404
      );
    }
    filtered = byAdmin;
  }

  // Provider-supplied names are printed to the terminal and, via
  // `weather status`, into shell prompts. Strip terminal control sequences
  // here so every consumer gets display-safe strings.
  const top = filtered[0];
  const displayName =
    stripControlChars(top.name, { maxLength: 100 }) ||
    sanitizeForDisplay(input) ||
    stripControlChars(`${top.latitude}, ${top.longitude}`, { maxLength: 100 });
  return {
    name: displayName,
    lat: top.latitude,
    lon: top.longitude,
    country: stripControlChars(top.country_code || '', { maxLength: 8 }),
    admin1: stripControlChars(top.admin1 || '', { maxLength: 100 })
  };
}
