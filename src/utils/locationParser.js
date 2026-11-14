// Parse variadic CLI location words into a single location string.
// Handles: option filtering (flags and their unit values), comma normalization.
// Does NOT expand state/country codes or hardcode cities — the Open-Meteo
// geocoding API resolves all of that via parseLocationQuery in src/api/openmeteo.js.

export function parseLocation(args) {
  if (!args || args.length === 0) return null;

  // Commander normally supplies positional words only. Keep raw-option
  // filtering for callers that include flags, without discarding city names
  // such as "imperial" just because they also name a unit system.
  const locationArgs = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '-u' || arg === '--units') {
      index++;
      continue;
    }
    if (!arg.startsWith('-')) locationArgs.push(arg);
  }

  if (locationArgs.length === 0) return null;

  let location = locationArgs.join(' ').trim();
  if (!location) return null;

  // Normalize spacing around commas: "City,State" -> "City, State"
  if (location.includes(',')) {
    location = location.replace(/\s*,\s*/g, ', ');
  }

  return location;
}
