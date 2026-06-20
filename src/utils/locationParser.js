// Parse variadic CLI location words into a single location string.
// Handles: option filtering (flags, unit keywords), comma normalization.
// Does NOT expand state/country codes or hardcode cities — the Open-Meteo
// geocoding API resolves all of that via parseLocationQuery in src/api/openmeteo.js.

export function parseLocation(args) {
  if (!args || args.length === 0) return null;

  // Join all arguments, filtering out CLI flags and unit keywords
  const locationArgs = args.filter(
    (arg) =>
      !arg.startsWith('-') && !['metric', 'imperial', 'celsius', 'fahrenheit', 'auto'].includes(arg)
  );

  if (locationArgs.length === 0) return null;

  let location = locationArgs.join(' ').trim();
  if (!location) return null;

  // Normalize spacing around commas: "City,State" -> "City, State"
  if (location.includes(',')) {
    location = location.replace(/\s*,\s*/g, ', ');
  }

  return location;
}
