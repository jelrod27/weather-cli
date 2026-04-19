#!/usr/bin/env node

import { program, Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { getWeather, getWeatherByCoords } from './src/weather.js';
import {
  getCachedWeather,
  setCachedWeather,
  cleanExpiredCache,
  getCacheStats,
  clearCache
} from './src/cache.js';
import {
  displayCurrentWeather,
  display5DayForecast,
  display24HourForecast
} from './src/display.js';
import {
  processTemperatureOptions,
  getDefaultLocation,
  getDefaultUnits,
  setDefaultLocation,
  setDefaultUnits,
  getAsciiConfig
} from './src/config.js';
import { WeatherError, mapErrorToExitCode } from './src/utils/errors.js';
import { setApiKey, testApiKey } from './src/api/auth.js';
import { parseLocation } from './src/utils/locationParser.js';
import { runStatus } from './src/commands/status.js';

dotenv.config({ quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
const VERSION = packageJson.version;

function withUnitOptions(cmd) {
  return cmd
    .option('-u, --units <type>', 'Temperature units (metric/imperial/celsius/fahrenheit)', 'auto')
    .option('--celsius', 'Force Celsius temperature display')
    .option('--fahrenheit', 'Force Fahrenheit temperature display');
}

function withArtOptions(cmd) {
  return cmd
    .option('--art', 'Display ASCII art weather scene')
    .option('--no-art', 'Disable ASCII art')
    .option('--art-only', 'Display only the ASCII art scene')
    .option('--art-style <style>', 'Art color style: default, retro')
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

async function showCurrentWeather(location, options, { forecast = false } = {}) {
  const userUnits = processTemperatureOptions(options);
  const artOpts = await buildArtOptions(options);
  const data = await fetchWithCache(location, userUnits);
  displayCurrentWeather(data, data.displayUnit, artOpts);
  if (forecast && !artOpts.artOnly) {
    display24HourForecast(data, data.displayUnit);
  }
  return data;
}

async function compareWeather(city1, city2, options) {
  const userUnits = processTemperatureOptions(options);
  console.log(chalk.cyan.bold(`\n🌍 Comparing weather: ${city1} vs ${city2}`));

  const [data1, data2] = await Promise.all([
    getWeather(city1, userUnits),
    getWeather(city2, userUnits)
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

function handleError(error) {
  if (error instanceof WeatherError) {
    console.error(chalk.red(`❌ ${error.message}`));
    if (error.code === 'API_KEY_MISSING') {
      console.log(chalk.yellow('Get your free API key at: https://openweathermap.org/api'));
      console.log(chalk.yellow('Then run: weather auth set'));
    } else if (error.code === 'LOCATION_NOT_FOUND') {
      console.log(chalk.yellow('Examples: "San Ramon, CA" or "London, UK"'));
    }
  } else {
    console.error(chalk.red(`❌ Unexpected error: ${error.message}`));
  }
  process.exit(mapErrorToExitCode(error));
}

program.name('weather').description('A beautiful CLI weather application').version(VERSION);

withArtOptions(
  withUnitOptions(
    program
      .argument('[location...]', 'Location words (e.g. "San Ramon CA" or "London")')
      .option('-f, --forecast', 'Include 24-hour forecast')
  )
).action(async (locationWords, options) => {
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
  await showCurrentWeather(location, options, { forecast: options.forecast });
});

withArtOptions(
  withUnitOptions(
    program.command('now [location]').description('Get current weather for a location')
  )
).action(async (location, options) => {
  const loc = await resolveLocation(location);
  await showCurrentWeather(loc, options);
});

withArtOptions(
  withUnitOptions(
    program.command('forecast [location]').description('Get 24-hour forecast for a location')
  )
).action(async (location, options) => {
  const loc = await resolveLocation(location);
  const userUnits = processTemperatureOptions(options);
  const artOpts = await buildArtOptions(options);
  const data = await fetchWithCache(loc, userUnits);
  displayCurrentWeather(data, data.displayUnit, artOpts);
  display24HourForecast(data, data.displayUnit);
});

withArtOptions(
  withUnitOptions(
    program.command('5day [location]').description('Get 5-day forecast for a location')
  )
).action(async (location, options) => {
  const loc = await resolveLocation(location);
  const userUnits = processTemperatureOptions(options);
  const artOpts = await buildArtOptions(options);
  const data = await fetchWithCache(loc, userUnits);
  displayCurrentWeather(data, data.displayUnit, artOpts);
  display5DayForecast(data, data.displayUnit);
});

withUnitOptions(
  program.command('compare <city1> <city2>').description('Compare weather between two cities')
).action(async (city1, city2, options) => {
  await compareWeather(city1, city2, options);
});

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
  displayCurrentWeather(data, data.displayUnit, artOpts);
});

program
  .command('config')
  .description('Configure default settings')
  .action(async () => {
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
      }
    ]);

    await setDefaultLocation(answers.defaultLocation);
    await setDefaultUnits(answers.defaultUnits);
    console.log(chalk.green('✅ Configuration saved!'));
  });

const authCommand = new Command('auth').description('Manage API authentication');
authCommand
  .command('set')
  .description('Set API key securely')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your OpenWeatherMap API key:',
        mask: '*',
        validate: (input) => input.length > 0 || 'API key cannot be empty'
      }
    ]);

    console.log(chalk.blue('Testing API key...'));
    try {
      await testApiKey(answers.apiKey);
      const saved = await setApiKey(answers.apiKey);
      if (saved) {
        console.log(chalk.green('✅ API key saved to system keychain'));
      } else {
        console.log(
          chalk.yellow(
            '⚠️  Could not save to keychain, please set WEATHER_API_KEY environment variable'
          )
        );
      }
    } catch {
      throw new WeatherError('Invalid API key', 'API_KEY_INVALID');
    }
  });
authCommand
  .command('test')
  .description('Test API key validity')
  .action(async () => {
    await testApiKey();
    console.log(chalk.green('✅ API key is valid'));
  });
program.addCommand(authCommand);

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

withUnitOptions(
  program
    .command('status [location...]')
    .description('One-line weather output for shell prompts / tmux status bars (reads cache only)')
    .option('--format <preset>', 'Output preset: default, compact, minimal', 'default')
    .option('--no-emoji', 'Omit the weather icon')
    .option('--refresh', 'Fetch fresh data if cache is empty or stale')
).action(async (locationWords, options) => {
  await runStatus(locationWords, options, { getDefaultLocation, processTemperatureOptions });
});

program
  .command('interactive')
  .alias('i')
  .description('Interactive mode with prompts')
  .action(interactiveMode);

program.parseAsync().catch(handleError);
