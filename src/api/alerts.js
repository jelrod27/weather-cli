import httpClient from './http.js';
import { stripControlChars } from '../utils/validators.js';

const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active';

/**
 * Severity levels in ascending order of impact.
 * Used for ordering and color-coding alert display.
 */
export const SEVERITY_ORDER = ['Minor', 'Moderate', 'Severe', 'Extreme'];

/**
 * NWS urgency levels in ascending order of immediacy.
 * Used for secondary sort within same-severity alerts.
 */
export const URGENCY_ORDER = ['Past', 'Future', 'Expected', 'Immediate'];

/**
 * Fetches active weather alerts for a given location.
 *
 * Currently supports US locations via the NWS Alerts API.
 * For non-US locations, returns an empty array (no alerts available).
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {Promise<Array>} Array of normalized alert objects
 */
export async function fetchAlerts(lat, lon, countryCode) {
  // Only US locations are supported via NWS Alerts API
  if (!countryCode || countryCode.toUpperCase() !== 'US') {
    return [];
  }

  try {
    const res = await httpClient.get(NWS_ALERTS_URL, {
      params: {
        point: `${lat},${lon}`
      },
      headers: {
        Accept: 'application/geo+json'
      }
    });

    const features = res.data?.features || [];
    if (features.length === 0) {
      return [];
    }

    return features.map((f) => normalizeNwsAlert(f.properties)).filter(Boolean);
  } catch {
    // Silently fail — alerts are supplementary, not critical
    return [];
  }
}

/**
 * Normalize an NWS alert properties object into a simple shape.
 *
 * @param {object} props - NWS alert properties
 * @returns {object|null} Normalized alert or null if missing required fields
 */
function normalizeNwsAlert(props) {
  if (!props || !props.event) return null;

  const severity = stripControlChars(props.severity || 'Unknown', { maxLength: 32 });
  const urgency = stripControlChars(props.urgency || 'Expected', { maxLength: 32 });

  // Snippet: first 200 chars of description, stripped of newlines
  const rawDesc = stripControlChars((props.description || '').replace(/\r?\n/g, ' '));
  const description = rawDesc.length > 200 ? rawDesc.slice(0, 197) + '...' : rawDesc;

  const event = stripControlChars(props.event, { maxLength: 200 });

  return {
    event,
    headline: stripControlChars(props.headline || event, { maxLength: 200 }),
    severity,
    urgency,
    description,
    effective: props.effective || null,
    expires: props.expires || null,
    areaDesc: stripControlChars(props.areaDesc || '', { maxLength: 500 })
  };
}

/**
 * Sort alerts by severity (most severe first), then by urgency.
 *
 * @param {Array} alerts - Array of normalized alert objects
 * @returns {Array} Sorted array
 */
export function sortAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const sevA = SEVERITY_ORDER.indexOf(a.severity);
    const sevB = SEVERITY_ORDER.indexOf(b.severity);
    if (sevA !== sevB) return sevB - sevA; // Higher severity first
    const urgA = URGENCY_ORDER.indexOf(a.urgency);
    const urgB = URGENCY_ORDER.indexOf(b.urgency);
    return urgB - urgA; // Higher urgency first
  });
}
