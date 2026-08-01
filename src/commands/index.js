import chalk from 'chalk';
import inquirer from 'inquirer';
import boxen from 'boxen';
import { getWeather, getWeatherByCoords } from '../weather.js';
import {
  getCachedWeather,
  setCachedWeather,
  cleanExpiredCache,
  getCacheStats,
  clearCache
} from '../cache.js';
import {
  displayCurrentWeather,
  display5DayForecast,
  display24HourForecast,
  displayMinutelyForecast
} from '../display.js';
import {
  processTemperatureOptions,
  getDefaultLocation,
  getDefaultUnits,
  setDefaultLocation,
  setDefaultUnits,
  getCacheTtl,
  setCacheTtl,
  getAsciiConfig
} from '../config.js';
import { WeatherError, mapErrorToExitCode } from '../utils/errors.js';
import { parseLocation } from '../utils/locationParser.js';
import { runStatus } from './status.js';
import { geocode } from '../api/openmeteo.js';
import { fetchHistorical, isValidDate } from '../api/historical.js';
import { fetchMarine, displayMarine } from '../api/marine.js';
import { palettes } from '../ascii/palette.js';
import { AsciiRenderer } from '../ascii/renderer.js';
import { getScene } from '../ascii/index.js';

// ─── Shared helpers ──────────────────────────────────────────────

function withUnitOptions(cmd) {
  return cmd
    .option('-u, --units <type>', 'Temperature units (metric/imperial/celsius/fahrenheit)', 'auto')
    .option('--celsius', 'Force Celsius temperature display')
    .option('--fahrenheit', 'Force Fahrenheit temperature display')
    .option('--json', 'Output raw JSON weather data instead of formatted terminal output');
}

function withArtOptions(cmd) {
  return cmd
    .option('--art', 'Display ASCII art weather scene')
    .option('--no-art', 'Disable ASCII art')
    .option('--art-only', 'Display only the ASCII art scene')
    .option(
      '--art-style <style>',
      'Art color style or "random" (use --list-themes to see all available themes)'
    )
    .option('--list-themes', 'List all available art themes and exit')
    .option('--preview-themes', 'Preview every theme with a sample scene and exit')
    .option('--animate', 'Animate the ASCII art scene');
}

async function buildArtOptions(options) {
  const config = await getAsciiConfig();
  const artOnly = options.artOnly || false;
  const artEnabled =
    artOnly || options.artStyle ? true : options.art !== undefined ? options.art : config.enabled;
  return {
    art: artEnabled,
    artOnly,
    artStyle: options.artStyle || config.style || 'default',
    animate: options.animate || false
  };
}

async function resolveLocation(provided) {
  if (provided) return provided;
  const defaultLocation = await getDefaultLocation();
  if (defaultLocation) return defaultLocation;
  console.error(chalk.red('❌ No location provided and no default set'));
  console.log(chalk.yellow('Examples: weather CA, weather San Ramon CA, weather London'));
  throw new WeatherError('No location provided', 'INVALID_INPUT');
}

async function fetchWithCache(location, userUnits, { fetcher = getWeather } = {}) {
  const cacheKey = userUnits || 'auto';
  const cached = await getCachedWeather(location, cacheKey);
  if (cached) {
    console.log(chalk.gray('📦 Using cached data...'));
    return cached;
  }
  const data = await fetcher(location, userUnits);
  await setCachedWeather(location, cacheKey, data);
  return data;
}

/**
 * Shared fetch + display logic for the common command pattern:
 * resolve location → fetch with cache → display current weather.
 */
async function runCurrentCommand(location, options, { forecast = false } = {}) {
  const userUnits = processTemperatureOptions(options);
  const artOpts = await buildArtOptions(options);
  const data = await fetchWithCache(location, userUnits);
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return data;
  }
  displayCurrentWeather(data, data.displayUnit, artOpts);
  if (forecast && !artOpts.artOnly) {
    display24HourForecast(data, data.displayUnit);
  }
  return data;
}

function listThemes() {
  const themeNames = Object.keys(palettes).filter((k) => k !== 'day' && k !== 'night');
  console.log(chalk.cyan.bold('Available art themes:\n'));
  for (const name of themeNames) {
    const p = palettes[name];
    const swatch = ['sky', 'sun', 'cloud', 'ground']
      .map((k) => chalk.hex(p[k])('\u2588\u2588'))
      .join('');
    console.log(`  ${swatch}  ${name}`);
  }
  console.log(chalk.gray(`\n${themeNames.length} themes. Use with: weather --art-style <name>`));
  console.log(chalk.gray(`'default' uses automatic day/night theming.`));
}

function previewThemes() {
  const themeNames = Object.keys(palettes).filter((k) => k !== 'day' && k !== 'night');
  const scene = getScene(800, {
    dt: Math.floor(Date.now() / 1000),
    sys: { sunrise: 0, sunset: Infinity }
  });
  const termWidth = process.stdout.columns || 80;

  console.log(chalk.cyan.bold('Theme preview (sunny scene):\n'));
  for (const name of themeNames) {
    console.log(chalk.gray(`--- ${name} ---`));
    const renderer = new AsciiRenderer({ termWidth, paletteName: name });
    renderer.render(scene, { isDay: true });
    console.log();
  }
  console.log(chalk.gray(`${themeNames.length} themes. Use with: weather --art-style <name>`));
}

function handleError(error) {
  if (error instanceof WeatherError) {
    console.error(chalk.red(`❌ ${error.message}`));
    if (error.code === 'LOCATION_NOT_FOUND') {
      console.log(chalk.yellow('Examples: "San Ramon, CA" or "London, UK"'));
    }
  } else {
    console.error(chalk.red(`❌ Unexpected error: ${error.message}`));
  }
  process.exit(mapErrorToExitCode(error));
}

async function compareWeather(city1, city2, options) {
  const userUnits = processTemperatureOptions(options);
  console.log(chalk.cyan.bold(`\n🌍 Comparing weather: ${city1} vs ${city2}`));

  const [data1, data2] = await Promise.all([
    fetchWithCache(city1, userUnits),
    fetchWithCache(city2, userUnits)
  ]);

  console.log(chalk.green('\n📍 City 1:'));
  displayCurrentWeather(data1, data1.displayUnit);
  console.log(chalk.green('\n📍 City 2:'));
  displayCurrentWeather(data2, data2.displayUnit);

  const temp1 = data1.current.main.temp;
  const temp2 = data2.current.main.temp;
  const diff = Math.abs(temp1 - temp2);
  const unit = data1.displayUnit === 'fahrenheit' ? 'F' : 'C';

  console.log(chalk.yellow(`\n🌡️  Temperature difference: ${diff.toFixed(1)}°${unit}`));
  if (temp1 > temp2) {
    console.log(chalk.red(`${city1} is warmer by ${diff.toFixed(1)}°`));
  } else if (temp2 > temp1) {
    console.log(chalk.red(`${city2} is warmer by ${diff.toFixed(1)}°`));
  } else {
    console.log(chalk.green('Both cities have the same temperature!'));
  }
}

async function interactiveMode() {
  const defaultLocation = await getDefaultLocation();
  const defaultUnits = await getDefaultUnits();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'location',
      message: 'Enter location:',
      default: defaultLocation || 'New York'
    },
    {
      type: 'list',
      name: 'units',
      message: 'Temperature units:',
      choices: [
        { name: 'Auto (based on location)', value: 'auto' },
        { name: 'Celsius (°C)', value: 'celsius' },
        { name: 'Fahrenheit (°F)', value: 'fahrenheit' }
      ],
      default: defaultUnits
    },
    {
      type: 'list',
      name: 'forecast',
      message: 'What would you like to see?',
      choices: [
        { name: 'Current weather only', value: 'current' },
        { name: 'Current + 24-hour forecast', value: '24h' },
        { name: 'Current + 5-day forecast', value: '5day' },
        { name: 'Everything', value: 'all' }
      ]
    }
  ]);

  const data = await getWeather(answers.location, answers.units);
  displayCurrentWeather(data, data.displayUnit);

  if (answers.forecast === '24h' || answers.forecast === 'all') {
    display24HourForecast(data, data.displayUnit);
  }
  if (answers.forecast === '5day' || answers.forecast === 'all') {
    display5DayForecast(data, data.displayUnit);
  }

  const saveDefault = await inquirer.prompt([
    { type: 'confirm', name: 'save', message: 'Save as default location?', default: false }
  ]);
  if (saveDefault.save) {
    await setDefaultLocation(answers.location);
    await setDefaultUnits(answers.units);
    console.log(chalk.green('✅ Default settings saved!'));
  }
}

// ─── Register all commands ───────────────────────────────────────

function registerAll(program) {
  // Default command (no subcommand)
  withArtOptions(
    withUnitOptions(
      program
        .argument('[location...]', 'Location words (e.g. "San Ramon CA" or "London")')
        .option('-f, --forecast', 'Include 24-hour forecast')
    )
  ).action(async (locationWords, options) => {
    if (options.listThemes) {
      listThemes();
      return;
    }
    if (options.previewThemes) {
      previewThemes();
      return;
    }
    if (!locationWords || locationWords.length === 0) {
      await interactiveMode();
      return;
    }
    const location = parseLocation(locationWords);
    if (!location) {
      console.error(chalk.red('❌ Please specify a location'));
      console.log(chalk.yellow('Examples: weather CA, weather San Ramon CA, weather London'));
      process.exit(1);
    }
    await runCurrentCommand(location, options, { forecast: options.forecast });
  });

  // now
  withArtOptions(
    withUnitOptions(
      program.command('now [location]').description('Get current weather for a location')
    )
  ).action(async (location, options) => {
    if (options.listThemes) {
      listThemes();
      return;
    }
    if (options.previewThemes) {
      previewThemes();
      return;
    }
    const loc = await resolveLocation(location);
    await runCurrentCommand(loc, options);
  });

  // forecast
  withArtOptions(
    withUnitOptions(
      program.command('forecast [location]').description('Get 24-hour forecast for a location')
    )
  ).action(async (location, options) => {
    if (options.listThemes) {
      listThemes();
      return;
    }
    if (options.previewThemes) {
      previewThemes();
      return;
    }
    const loc = await resolveLocation(location);
    const userUnits = processTemperatureOptions(options);
    const artOpts = await buildArtOptions(options);
    const data = await fetchWithCache(loc, userUnits);
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    displayCurrentWeather(data, data.displayUnit, artOpts);
    display24HourForecast(data, data.displayUnit);
  });

  // 5day
  withArtOptions(
    withUnitOptions(
      program.command('5day [location]').description('Get 5-day forecast for a location')
    )
  ).action(async (location, options) => {
    if (options.listThemes) {
      listThemes();
      return;
    }
    if (options.previewThemes) {
      previewThemes();
      return;
    }
    const loc = await resolveLocation(location);
    const userUnits = processTemperatureOptions(options);
    const artOpts = await buildArtOptions(options);
    const data = await fetchWithCache(loc, userUnits);
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    displayCurrentWeather(data, data.displayUnit, artOpts);
    display5DayForecast(data, data.displayUnit);
  });

  // compare
  withUnitOptions(
    program.command('compare <city1> <city2>').description('Compare weather between two cities')
  ).action(async (city1, city2, options) => {
    await compareWeather(city1, city2, options);
  });

  // coords
  withArtOptions(
    withUnitOptions(
      program
        .command('coords <coordinates>')
        .description('Get weather by GPS coordinates (format: lat,lon)')
    )
  ).action(async (coordinates, options) => {
    const [lat, lon] = coordinates.split(',').map((c) => c.trim());
    const userUnits = processTemperatureOptions(options);
    const artOpts = await buildArtOptions(options);
    const data = await fetchWithCache(`${lat},${lon}`, userUnits, {
      fetcher: (_loc, units) => getWeatherByCoords(lat, lon, units)
    });
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    displayCurrentWeather(data, data.displayUnit, artOpts);
  });

  // radar
  withUnitOptions(
    program.command('radar [location]').description('Show precipitation radar for the next hour')
  ).action(async (location, options) => {
    const loc = await resolveLocation(location);
    const userUnits = processTemperatureOptions(options);
    // Always fetch fresh data for radar — minute-level precipitation changes fast
    const data = await getWeather(loc, userUnits, { includeMinutely: true });
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    displayMinutelyForecast(data, data.displayUnit);
  });

  // config
  program
    .command('config')
    .description('Configure default settings')
    .action(async () => {
      const currentTtl = await getCacheTtl();
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'defaultLocation',
          message: 'Default location:',
          default: (await getDefaultLocation()) || ''
        },
        {
          type: 'list',
          name: 'defaultUnits',
          message: 'Default temperature units:',
          choices: [
            { name: 'Auto (based on location)', value: 'auto' },
            { name: 'Celsius (°C)', value: 'celsius' },
            { name: 'Fahrenheit (°F)', value: 'fahrenheit' }
          ],
          default: await getDefaultUnits()
        },
        {
          type: 'input',
          name: 'cacheTtl',
          message: 'Cache TTL in minutes (1-1440, blank for default 30):',
          default: currentTtl ? String(currentTtl) : '',
          validate: (input) => {
            const trimmed = input.trim();
            if (!trimmed) return true;
            const num = Number.parseInt(trimmed, 10);
            return Number.isInteger(num) && num >= 1 && num <= 1440
              ? true
              : 'Enter a number between 1 and 1440, or leave blank for default.';
          },
          filter: (input) => {
            const trimmed = input.trim();
            if (!trimmed) return null;
            return Number.parseInt(trimmed, 10);
          }
        }
      ]);

      await setDefaultLocation(answers.defaultLocation);
      await setDefaultUnits(answers.defaultUnits);
      await setCacheTtl(answers.cacheTtl);
      console.log(chalk.green('Configuration saved!'));
    });

  // cache
  program
    .command('cache')
    .description('Manage weather cache')
    .option('-c, --clear', 'Clear all cached data')
    .option('--clean', 'Clean expired cache entries')
    .action(async (options) => {
      if (options.clear) {
        await clearCache();
        console.log(chalk.green('✅ Cache cleared!'));
      } else if (options.clean) {
        const cleaned = await cleanExpiredCache();
        if (cleaned === 0) {
          console.log(chalk.blue('📦 No expired entries to clean'));
        }
      } else {
        const stats = await getCacheStats();
        console.log(chalk.blue(`📦 Cache statistics:`));
        console.log(chalk.white(`  Total entries: ${stats.total}`));
        console.log(chalk.green(`  Valid entries: ${stats.valid}`));
        console.log(chalk.yellow(`  Expired entries: ${stats.expired}`));
      }
    });

  // status
  withUnitOptions(
    program
      .command('status [location...]')
      .description(
        'One-line weather output for shell prompts / tmux status bars (reads cache only)'
      )
      .option('--format <preset>', 'Output preset: default, compact, minimal', 'default')
      .option('--no-emoji', 'Omit the weather icon')
      .option('--refresh', 'Fetch fresh data if cache is empty or stale')
  ).action(async (locationWords, options) => {
    await runStatus(locationWords, options, { getDefaultLocation, processTemperatureOptions });
  });

  // watch
  withArtOptions(
    withUnitOptions(
      program
        .command('watch [location]')
        .description('Watch current weather — auto-refreshes the display on an interval')
        .option('-i, --interval <minutes>', 'Refresh interval in minutes (1-60)', '5')
    )
  ).action(async (location, options) => {
    const loc = await resolveLocation(location);

    const intervalRaw = Number.parseInt(options.interval, 10);
    const intervalMinutes =
      Number.isInteger(intervalRaw) && intervalRaw >= 1 && intervalRaw <= 60 ? intervalRaw : 5;
    const intervalMs = intervalMinutes * 60 * 1000;

    let nextRefreshAt = Date.now() + intervalMs;

    async function render() {
      const userUnits = processTemperatureOptions(options);
      const artOpts = await buildArtOptions(options);
      const data = await fetchWithCache(loc, userUnits);

      const remainingMs = Math.max(0, nextRefreshAt - Date.now());
      const remainingSec = Math.round(remainingMs / 1000);
      const mm = Math.floor(remainingSec / 60);
      const ss = String(remainingSec % 60).padStart(2, '0');
      const countdown = `${mm}:${ss}`;

      console.clear();
      console.log(
        chalk.cyan.bold(
          `🔄 Watching weather for ${loc}  ·  refreshing every ${intervalMinutes}m (next in ${countdown})`
        )
      );
      console.log(chalk.gray('─'.repeat(Math.min(60, process.stdout.columns || 60))));
      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      displayCurrentWeather(data, data.displayUnit, artOpts);
    }

    function resetCountdown() {
      nextRefreshAt = Date.now() + intervalMs;
    }

    process.on('SIGINT', () => {
      console.clear();
      console.log(chalk.gray('Watch stopped.'));
      process.exit(0);
    });

    await render();
    resetCountdown();
    setInterval(async () => {
      try {
        await render();
        resetCountdown();
      } catch (err) {
        console.error(chalk.red(`❌ Refresh failed: ${err.message}`));
      }
    }, intervalMs);
  });

  // marine
  withUnitOptions(
    program
      .command('marine [location]')
      .description(
        'Show marine/ocean conditions (wave height, direction, period, sea surface temp) for a coastal location'
      )
  ).action(async (location, options) => {
    const loc = await resolveLocation(location);
    const place = await geocode(loc);
    const marine = await fetchMarine(place.lat, place.lon);

    if (!marine) {
      console.log(chalk.yellow('No marine data available for this location (may be inland).'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify({ place, marine }, null, 2));
      return;
    }

    console.log(displayMarine(marine, place));
  });

  // history
  program
    .command('history [location]')
    .description('Show historical weather for a given date (Open-Meteo Archive API)')
    .option('-d, --date <YYYY-MM-DD>', 'Date to fetch (required, format YYYY-MM-DD)')
    .action(async (location, options) => {
      if (!options.date) {
        console.error(chalk.red('❌ --date <YYYY-MM-DD> is required for the history command'));
        console.log(chalk.yellow('Example: weather history --date 2023-07-15 "San Ramon, CA"'));
        process.exit(6);
      }
      if (!isValidDate(options.date)) {
        console.error(
          chalk.red(
            `❌ Invalid date "${options.date}". Expected format: YYYY-MM-DD (e.g. 2023-07-15).`
          )
        );
        console.log(
          chalk.yellow(
            'Note: the date must be a real calendar day in the past covered by the archive.'
          )
        );
        process.exit(6);
      }

      const loc = await resolveLocation(location);
      const place = await geocode(loc);
      const data = await fetchHistorical(place.lat, place.lon, options.date);

      if (options.json) {
        console.log(JSON.stringify({ place, data }, null, 2));
        return;
      }

      const locationLabel = place.admin1
        ? `${place.name}, ${place.admin1}, ${place.country}`
        : `${place.name}, ${place.country}`;

      const temp = (v, suffix) =>
        v === null || v === undefined ? 'N/A' : `${Math.round(v)}${suffix}`;
      const precip = (v) => (v === null || v === undefined ? 'N/A' : `${v.toFixed(1)} mm`);
      const wind = (v) => (v === null || v === undefined ? 'N/A' : `${v.toFixed(1)} km/h`);

      const lines = [
        `${chalk.cyan.bold('Date')}          ${chalk.white(data.date)}`,
        `${chalk.cyan.bold('Location')}      ${chalk.white(locationLabel)}`,
        `${chalk.cyan.bold('Temp Max')}      ${chalk.red(temp(data.tempMax, '°C'))}`,
        `${chalk.cyan.bold('Temp Min')}      ${chalk.blue(temp(data.tempMin, '°C'))}`,
        `${chalk.cyan.bold('Temp Mean')}     ${chalk.yellow(temp(data.tempMean, '°C'))}`,
        `${chalk.cyan.bold('Precipitation')} ${chalk.green(precip(data.precipSum))}`,
        `${chalk.cyan.bold('Max Wind')}      ${chalk.magenta(wind(data.maxWind))}`,
        `${chalk.cyan.bold('Conditions')}   ${chalk.gray(data.description)}`
      ];

      console.log(
        boxen(lines.join('\n'), {
          padding: { top: 0, bottom: 0, left: 1, right: 1 },
          margin: 0,
          borderStyle: 'round',
          borderColor: 'cyan',
          title: '🗓️  Historical Weather',
          titleAlignment: 'left'
        })
      );
    });

  // interactive
  program
    .command('interactive')
    .alias('i')
    .description('Interactive mode with prompts')
    .action(interactiveMode);
}

export { registerAll, handleError };
