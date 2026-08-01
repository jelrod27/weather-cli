import chalk from 'chalk';
import boxen from 'boxen';
import { getScene, isDaytime } from './ascii/index.js';
import { AsciiRenderer } from './ascii/renderer.js';
import { renderBrailleLineChart, dataPointColumns, buildLabelRow } from './ascii/sparkline.js';
import { getMoonPhase } from './utils/moon.js';
import { weatherEmojis } from './utils/icons.js';
import { palettes } from './ascii/palette.js';
import {
  formatTemp,
  formatFeelsLike,
  formatWindSpeed,
  formatVisibility,
  formatTime,
  formatRelativeTime,
  degToCardinal,
  getAirQualityDescription,
  formatUvIndex,
  formatDewPoint,
  formatPrecipProbability,
  formatWindDescription,
  formatDaylight,
  formatPressureTrend,
  formatMoonPhase,
  formatCape,
  formatSolarRadiation,
  createDataRow,
  modeValue,
  getTerminalWidth,
  visibleLength,
  padVisible,
  renderTwoColumnRows,
  severityColor,
  severityBorderColor
} from './formatters.js';

// Derive named themes from the palettes object so they never drift.
// 'day' and 'night' are automatic fallbacks, not user-selectable themes.
const NAMED_STYLES = Object.keys(palettes).filter((k) => k !== 'day' && k !== 'night');

function resolveArtStyle(artStyle, isDay) {
  if (artStyle === 'random') {
    return NAMED_STYLES[Math.floor(Math.random() * NAMED_STYLES.length)];
  }
  return NAMED_STYLES.includes(artStyle) ? artStyle : isDay ? 'day' : 'night';
}

/**
 * Render weather alerts as a string of bordered boxes.
 * Shows each alert as: ⚠️ HEADLINE [SEVERITY] with the description snippet.
 *
 * @param {Array} alerts - Array of normalized alert objects
 * @returns {string} Formatted alerts string, or empty string if no alerts
 */
function displayAlerts(alerts) {
  if (!alerts || alerts.length === 0) return '';

  const termWidth = getTerminalWidth();
  const boxWidth = Math.min(termWidth - 2, 88);
  const parts = [];

  for (const alert of alerts) {
    const color = severityColor(alert.severity);
    const borderColor = severityBorderColor(alert.severity);

    const header = color(`⚠️  ${alert.headline}`);
    const urgency = `Urgency: ${alert.urgency}`;
    const severity = `Severity: ${alert.severity}`;
    const meta = `${severity}  |  ${urgency}`;
    const desc = alert.description ? chalk.gray(alert.description) : '';

    const lines = [header, '', meta];
    if (desc) {
      lines.push('', desc);
    }

    const content = lines.join('\n');

    parts.push(
      boxen(content, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
        borderStyle: 'bold',
        borderColor,
        width: boxWidth
      })
    );
  }

  return parts.join('\n');
}

function displayCurrentWeather(data, displayUnit, options = {}) {
  const windUnit = data.windUnit || (displayUnit === 'fahrenheit' ? 'mph' : 'ms');
  const weather = data.current || data;

  if (!weather || !weather.weather || !weather.weather[0]) {
    console.error(chalk.red('❌ Invalid weather data structure'));
    return;
  }

  const canShowArt = options.art && (process.stdout.isTTY || options.artOnly);
  if (canShowArt) {
    const conditionCode = weather.weather[0].id;
    const isDay = isDaytime(weather);
    const scene = getScene(conditionCode, weather);
    const paletteName = resolveArtStyle(options.artStyle, isDay);
    const renderer = new AsciiRenderer({
      termWidth: getTerminalWidth(),
      paletteName
    });

    if (options.animate && process.stdout.isTTY && scene.getFrames) {
      const stopAnimation = renderer.animate(scene, { isDay });
      process.on('SIGINT', () => {
        stopAnimation();
        process.exit(0);
      });
      return;
    } else {
      renderer.render(scene, { isDay });
    }

    if (options.artOnly) return;
    console.log();
  }

  // Show active weather alerts above the main box
  if (data.alerts && data.alerts.length > 0) {
    const alertOutput = displayAlerts(data.alerts);
    if (alertOutput) {
      console.log(alertOutput);
      console.log();
    }
  }

  const emoji = weatherEmojis[weather.weather[0].main] || '🌤️';
  const termWidth = getTerminalWidth();

  const boxWidth = Math.min(termWidth - 2, 88);
  const innerWidth = boxWidth - 4;
  const useTwoCol = innerWidth >= 64;

  const locationHeader = weather.sys.country
    ? `${emoji}  ${chalk.cyan.bold(weather.name)}, ${chalk.yellow.bold(weather.sys.country)}`
    : `${emoji}  ${chalk.cyan.bold(weather.name)}`;

  const aqi = data.pollution?.list?.[0]?.main?.aqi;
  const windGust = weather.wind.gust
    ? ` (gust ${formatWindSpeed(weather.wind.gust, displayUnit, windUnit)})`
    : '';
  const wind = `${formatWindSpeed(weather.wind.speed, displayUnit, windUnit)} @ ${weather.wind.deg}° ${degToCardinal(weather.wind.deg)}${windGust}`;
  const visFormatted = formatVisibility(weather.visibility, displayUnit);

  const left = [
    chalk.gray(weather.weather[0].description),
    formatTemp(weather.main.temp, displayUnit, { colorCode: true, type: 'current' }),
    `Feels Like: ${formatFeelsLike(weather.main.feels_like, displayUnit)}`,
    `Humidity:   ${weather.main.humidity}%`,
    `UV Index:   ${formatUvIndex(weather.uv_index)}`,
    `Pressure:   ${weather.main.pressure} hPa ${formatPressureTrend(weather.pressure_trend?.trend, weather.pressure_trend?.delta)}`,
    `Dew Point:  ${formatDewPoint(weather.dew_point, displayUnit)}`,
    `Cloud Cover: ${weather.cloud_cover ?? 'N/A'}%`,
    `Rain Chance:  ${formatPrecipProbability(weather.precip_probability)}%`,
    `CAPE:       ${formatCape(weather.cape)}`
  ];

  const right = [
    `Sunrise:     ${formatTime(weather.sys.sunrise)} (${formatRelativeTime(weather.sys.sunrise)})`,
    `Sunset:      ${formatTime(weather.sys.sunset)} (${formatRelativeTime(weather.sys.sunset)})`,
    `Daylight:    ${formatDaylight(weather.sys.sunrise, weather.sys.sunset)}`,
    `Moon:        ${formatMoonPhase(getMoonPhase())}`,
    `Solar:      ${formatSolarRadiation(weather.solar_radiation)}`,
    aqi ? `Air Quality: ${getAirQualityDescription(aqi)} (AQI: ${aqi})` : '',
    `Min/Max:     ${formatTemp(weather.main.temp_min, displayUnit, { colorCode: true, type: 'min' })} / ${formatTemp(weather.main.temp_max, displayUnit, { colorCode: true, type: 'max' })}`,
    `Wind:        ${wind} (${formatWindDescription(weather.wind.speed, windUnit)})`,
    `Visibility:  ${visFormatted}`
  ].filter(Boolean);

  let body;
  if (useTwoCol) {
    const leftWidth = Math.max(...left.map(visibleLength), 20);
    body = renderTwoColumnRows(left, right, leftWidth);
  } else {
    body = [...left, ...right].join('\n');
  }

  const content = [locationHeader, '', body].join('\n');

  console.log(
    boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: 0,
      borderStyle: 'round',
      borderColor: 'cyan',
      width: boxWidth
    })
  );
}

function display5DayForecast(data, displayUnit) {
  const dailyData = {};
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  data.forecast.list.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const dateKey = date.toDateString();
    const dayIndex = date.getDay();

    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        temps: [],
        descriptions: [],
        dayName: dayNames[dayIndex],
        isToday: dayIndex === today,
        date: date
      };
    }
    dailyData[dateKey].temps.push(item.main.temp);
    dailyData[dateKey].descriptions.push({
      main: item.weather[0].main,
      description: item.weather[0].description
    });
  });

  // Collect AQI values from forecast items per day, then use the
  // pre-computed dailyAqi map as a fallback.
  const forecastAqiByDay = {};
  data.forecast.list.forEach((item) => {
    if (item.aqi !== null && item.aqi !== undefined) {
      const dateKey = new Date(item.dt * 1000).toDateString();
      if (!forecastAqiByDay[dateKey]) forecastAqiByDay[dateKey] = [];
      forecastAqiByDay[dateKey].push(item.aqi);
    }
  });

  const aqiEmojis = { 1: '🟢', 2: '🟡', 3: '🟠', 4: '🔴', 5: '🟣' };

  const forecastLines = Object.entries(dailyData)
    .slice(0, 5)
    .map(([dateKey, info]) => {
      const minTemp = Math.min(...info.temps);
      const maxTemp = Math.max(...info.temps);

      const weatherCount = {};
      info.descriptions.forEach((desc) => {
        weatherCount[desc.main] = (weatherCount[desc.main] || 0) + 1;
      });
      const mostCommonWeather = Object.entries(weatherCount).sort(([, a], [, b]) => b - a)[0][0];
      const emoji = weatherEmojis[mostCommonWeather] || '🌤️';

      const dayLabel = info.isToday ? chalk.yellow(`${info.dayName}`) : info.dayName;
      const temps = `${formatTemp(minTemp, displayUnit, { colorCode: true, type: 'min' })}/${formatTemp(maxTemp, displayUnit, { colorCode: true, type: 'max' })}`;

      // Prefer forecast-item AQI mode, fall back to dailyAqi map
      let aqiLabel = '';
      const dailyAqi = data.dailyAqi?.[dateKey];
      const itemAqis = forecastAqiByDay[dateKey];
      if (itemAqis && itemAqis.length > 0) {
        const mode = modeValue(itemAqis);
        const aqEmoji = aqiEmojis[mode] || '';
        aqiLabel = ` ${aqEmoji}${getAirQualityDescription(mode)}`;
      } else if (dailyAqi !== null && dailyAqi !== undefined) {
        const aqEmoji = aqiEmojis[dailyAqi] || '';
        aqiLabel = ` ${aqEmoji}${getAirQualityDescription(dailyAqi)}`;
      }

      return `${emoji} ${dayLabel.padEnd(4)} ${temps}${aqiLabel}`;
    });

  console.log(
    boxen(forecastLines.join('\n'), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: 0,
      borderStyle: 'round',
      borderColor: 'green'
    })
  );
}

// Render the 24-hour forecast as a braille line chart with an emoji band
// and time axis underneath. Falls back to a list view on terminals too narrow
// to fit the chart cleanly (or when there isn't enough data to interpolate).
function display24HourForecast(data, displayUnit) {
  const next24Hours = data.forecast.list.slice(0, 8);
  if (next24Hours.length < 2) return; // nothing meaningful to chart

  const termWidth = getTerminalWidth();
  const boxWidth = Math.min(termWidth - 2, 88);
  const innerWidth = boxWidth - 4; // accounts for boxen padding (left+right=2) + borders (1+1)

  const renderedSpark = renderSparklineBlock(next24Hours, displayUnit, innerWidth);

  // Build AQI summary line for the 24-hour period
  const aqiValues = next24Hours
    .map((item) => item.aqi)
    .filter((v) => v !== null && v !== undefined);
  let aqiSummaryLine = '';
  if (aqiValues.length > 0) {
    const modeAqi = modeValue(aqiValues);
    const currentAqi = data.pollution?.list?.[0]?.main?.aqi;
    const displayAqi = currentAqi ?? modeAqi;
    aqiSummaryLine = `\nAir Quality: ${getAirQualityDescription(displayAqi)} (AQI: ${displayAqi})`;
  }

  const content = (renderedSpark || renderForecastList(next24Hours, displayUnit)) + aqiSummaryLine;

  console.log(
    boxen(content, {
      title: chalk.bold('24-hour forecast'),
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: 0,
      borderStyle: 'round',
      borderColor: 'blue',
      width: boxWidth
    })
  );
}

function renderSparklineBlock(items, displayUnit, innerWidth) {
  const temps = items.map((item) => item.main.temp);
  const emojis = items.map((item) => weatherEmojis[item.weather[0].main] || '🌤️');
  const times = items.map(
    (item) =>
      new Date(item.dt * 1000)
        .toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
        .replace(/\s/g, '')
        .toLowerCase()
        .replace(/m$/, '') // "12pm" → "12p", "9am" → "9a"
  );

  // Gutter on the left holds hi/lo °labels (e.g. "82°F  ").
  const gutterText = '999°F  '; // worst-case width
  const gutter = gutterText.length;

  // 4 cells per data point is the readability floor (3-char time + 1 space).
  const minStep = 4;
  const maxStep = 10;
  const availableForChart = innerWidth - gutter;
  const stepFromAvail = Math.floor(availableForChart / items.length);
  if (stepFromAvail < minStep) return null;

  const step = Math.min(maxStep, stepFromAvail);
  const chartWidth = step * (items.length - 1) + 1;
  const chartHeight = 4;

  const chart = renderBrailleLineChart(temps, { width: chartWidth, height: chartHeight });
  if (!chart) return null;

  const lines = chart.split('\n');
  const hi = Math.max(...temps);
  const lo = Math.min(...temps);
  const hiLabel = formatTemp(hi, displayUnit, { colorCode: true, type: 'max' });
  const loLabel = formatTemp(lo, displayUnit, { colorCode: true, type: 'min' });

  // Top row gets the hi label, bottom row gets the lo label, others get pure padding.
  const chartRows = lines.map((line, i) => {
    let label = '';
    if (i === 0) label = hiLabel;
    else if (i === lines.length - 1) label = loLabel;
    return padVisible(label, gutter) + chalk.cyan(line);
  });

  const cols = dataPointColumns(items.length, chartWidth);
  // Treat each weather emoji as 2 cells (variation-selector emoji width is
  // terminal-dependent but 2 is the dominant default in modern emulators).
  const emojiRow =
    ' '.repeat(gutter) + buildLabelRow(emojis, cols, new Array(items.length).fill(2));
  const timeRow =
    ' '.repeat(gutter) +
    chalk.gray(
      buildLabelRow(
        times,
        cols,
        times.map((t) => t.length)
      )
    );

  return [...chartRows, emojiRow, timeRow].join('\n');
}

function renderForecastList(items, displayUnit) {
  return items
    .map((item) => {
      const time = new Date(item.dt * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
      });
      const emoji = weatherEmojis[item.weather[0].main] || '🌤️';
      const temp = formatTemp(item.main.temp, displayUnit);
      const aqiTag =
        item.aqi !== null && item.aqi !== undefined ? ` ${getAirQualityDescription(item.aqi)}` : '';
      return `${time.padEnd(6)} ${emoji} ${temp.padEnd(6)} ${chalk.gray(item.weather[0].description)}${aqiTag}`;
    })
    .join('\n');
}

/**
 * Render a precipitation chart for the next hour using Open-Meteo minutely_15
 * data.  Shows up to 4 intervals (4 × 15 minutes = 60 min) as a continuous
 * braille-style bar chart inside a bordered box.
 *
 * @param {object} data - Normalised weather data (must include data.minutely)
 * @param {string} displayUnit - 'celsius' or 'fahrenheit' (unused for precip but kept for API consistency)
 */
function displayMinutelyForecast(data, _displayUnit) {
  const minutely = data.minutely || {};
  const precip = minutely.precipitation || [];

  if (precip.length === 0) {
    console.log(chalk.yellow('📦 No minutely precipitation data available for this location.'));
    return;
  }

  // Show up to 4 intervals (60 minutes). The API may return more; we take
  // the first 4 which correspond to the next hour.
  const maxIntervals = Math.min(precip.length, 4);
  const values = precip.slice(0, maxIntervals);

  // If all values are zero or the array is too short, still show the chart
  // but indicate no precipitation expected.
  const termWidth = process.stdout.columns || 80;
  const boxWidth = Math.min(termWidth - 2, 88);
  const innerWidth = boxWidth - 4; // boxen padding + borders

  // Build a continuous braille bar chart.
  // We stretch the precipitation values across the inner width using the
  // braille chart renderer for a smooth line.
  let chartLine;
  if (values.length >= 2) {
    chartLine = renderBrailleLineChart(values, { width: innerWidth, height: 2 });
  } else {
    // Single data point — show a simple bar representation
    chartLine = values[0] > 0 ? '█'.repeat(innerWidth) : '─'.repeat(innerWidth);
  }

  // Determine colour based on peak precipitation
  const peakPrecip = Math.max(...values, 0);
  let precipColor = chalk.cyan;
  if (peakPrecip >= 5) precipColor = chalk.red;
  else if (peakPrecip >= 2) precipColor = chalk.yellow;
  else if (peakPrecip >= 0.5) precipColor = chalk.blue;

  // Build time labels
  const timeLabels = [];
  for (let i = 0; i < maxIntervals; i++) {
    if (i === 0) timeLabels.push('Now');
    else timeLabels.push(`${i * 15}m`);
  }
  // Always add the endpoint label if we have intervals
  if (maxIntervals >= 2) {
    timeLabels.push(`${maxIntervals * 15}m`);
  }

  // Place labels at positions proportional to the chart
  const labelPositions = timeLabels.map((label, i) => {
    // Spread labels across the chart width
    const col =
      maxIntervals <= 1 ? 0 : Math.round((i / (timeLabels.length - 1 || 1)) * (innerWidth - 1));
    return { label, col };
  });

  const labelRow = labelPositions
    .reduce(
      (acc, { label, col }) => {
        const startCol = Math.max(col, acc.cursor);
        acc.parts.push(' '.repeat(Math.max(0, startCol - acc.cursor)) + label);
        acc.cursor = startCol + label.length;
        return acc;
      },
      { parts: [], cursor: 0 }
    )
    .parts.join('');

  // Peak precipitation description
  let precipDesc = 'No precipitation expected in the next hour';
  if (peakPrecip > 0) {
    precipDesc = `Peak: ${peakPrecip.toFixed(1)} mm/15min`;
  }

  // Determine if any precipitation is happening
  const hasRain = values.some((v) => v > 0);
  const icon = hasRain ? '🌧️' : '☀️';
  const titleText = hasRain ? 'Precipitation next hour' : 'No rain next hour';

  const content = [
    precipColor(chartLine),
    '',
    chalk.gray(labelRow),
    '',
    chalk.white(precipDesc)
  ].join('\n');

  console.log(
    boxen(content, {
      title: chalk.bold(`${icon} ${titleText}`),
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: 0,
      borderStyle: 'round',
      borderColor: hasRain ? 'blue' : 'green',
      width: boxWidth
    })
  );
}

// Re-export formatters for backward compatibility with existing tests and
// external consumers. New code should import from formatters.js directly.
export {
  formatTemp,
  formatFeelsLike,
  formatWindSpeed,
  formatVisibility,
  formatTime,
  formatRelativeTime,
  degToCardinal,
  getAirQualityDescription,
  formatUvIndex,
  displayCurrentWeather,
  display5DayForecast,
  display24HourForecast,
  displayAlerts,
  displayMinutelyForecast,
  formatDewPoint,
  formatPrecipProbability,
  formatWindDescription,
  formatDaylight,
  formatPressureTrend,
  formatMoonPhase,
  formatCape,
  formatSolarRadiation,
  createDataRow
};
