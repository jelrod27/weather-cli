import chalk from 'chalk';
import { getCachedWeather, setCachedWeather } from '../cache.js';
import { getWeather } from '../weather.js';
import { iconFor } from '../utils/icons.js';

// Single-line output for shell prompts and tmux status bars.
// Reads cache only by default; exits 1 when cache is empty so prompts can skip rendering.
export async function runStatus(
  locationWords,
  options,
  { getDefaultLocation, processTemperatureOptions }
) {
  const fromArgs = locationWords && locationWords.length > 0 ? locationWords.join(' ') : null;
  const location = fromArgs || (await getDefaultLocation());
  if (!location) {
    if (options.refresh) {
      process.stderr.write('No location provided and no default set\n');
    }
    process.exit(1);
  }

  const userUnits = processTemperatureOptions(options);
  const cacheKey = userUnits || 'auto';

  let data = await getCachedWeather(location, cacheKey);
  if (!data) {
    if (!options.refresh) process.exit(1);
    data = await getWeather(location, userUnits);
    await setCachedWeather(location, cacheKey, data);
  }

  process.stdout.write(formatStatus(data, options) + '\n');
}

export function formatStatus(data, options = {}) {
  const weather = data.current || data;
  const main = weather.weather?.[0]?.main;
  const temp = Math.round(weather.main.temp);
  const hi = Math.round(weather.main.temp_max);
  const lo = Math.round(weather.main.temp_min);
  const unit = data.displayUnit === 'fahrenheit' ? '°F' : '°C';
  const icon = options.noEmoji ? '' : iconFor(main);
  const name = weather.name;

  const fmt = options.format || 'default';
  if (fmt === 'minimal') {
    return `${temp}${unit}`;
  }
  if (fmt === 'compact') {
    return [icon, `${temp}${unit}`].filter(Boolean).join(' ');
  }
  // default
  return [icon, name, chalk.bold(`${temp}${unit}`), chalk.dim(`↑${hi} ↓${lo}`)]
    .filter(Boolean)
    .join(' ');
}
