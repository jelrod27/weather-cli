import chalk from 'chalk';
import boxen from 'boxen';
import { getScene, isDaytime } from './ascii/index.js';
import { AsciiRenderer } from './ascii/renderer.js';
import { renderBrailleLineChart, dataPointColumns, buildLabelRow } from './ascii/sparkline.js';
import { weatherEmojis } from './utils/icons.js';

function formatTemp(temp, displayUnit, options = {}) {
  const unit = displayUnit === 'fahrenheit' ? '°F' : '°C';
  const rounded = Math.round(temp);
  const tempString = `${rounded}${unit}`;

  if (options.colorCode) {
    if (options.type === 'max') return chalk.red(tempString);
    if (options.type === 'min') return chalk.blue(tempString);
    if (options.type === 'current') return chalk.yellow(tempString);
  }

  return tempString;
}

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function degToArrow(deg) {
  // Normalize to 0-360
  const d = ((deg % 360) + 360) % 360;
  // 8 directions, each spanning 45°, centered on cardinal
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const index = Math.round(d / 45) % 8;
  return arrows[index];
}

function degToCardinal(deg) {
  const d = ((deg % 360) + 360) % 360;
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(d / 45) % 8;
  return cardinals[index];
}

function formatWindDirection(deg) {
  return `${degToArrow(deg)}${degToCardinal(deg)} (${deg}°)`;
}

function formatWindSpeed(speed, displayUnit, windUnit) {
  if (windUnit === 'mph') {
    // API already returned mph — no conversion needed
    return `${speed.toFixed(1)} mph`;
  }
  if (displayUnit === 'fahrenheit') {
    // API returned m/s, convert to mph
    const mph = speed * 2.237;
    return `${mph.toFixed(1)} mph`;
  }
  return `${speed.toFixed(1)} m/s`;
}

function formatVisibility(meters, displayUnit) {
  if (displayUnit === 'fahrenheit') {
    const miles = meters / 1609.344;
    return `${miles.toFixed(1)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

function createDataRow(label, value, options = {}) {
  const { labelWidth = 20, icon = '' } = options;
  const formattedLabel = icon ? `${icon} ${label}` : label;
  return `${formattedLabel.padEnd(labelWidth)} ${value}`;
}

function getAirQualityDescription(aqi) {
  const descriptions = {
    1: { text: 'Good', color: chalk.green },
    2: { text: 'Fair', color: chalk.greenBright },
    3: { text: 'Moderate', color: chalk.yellow },
    4: { text: 'Poor', color: chalk.red },
    5: { text: 'Very Poor', color: chalk.magenta }
  };
  const desc = descriptions[aqi] || { text: 'Unknown', color: chalk.gray };
  return desc.color(desc.text);
}

function getTerminalWidth() {
  return process.stdout.columns || 80;
}

// Strip ANSI escape codes so padEnd uses visible width
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function visibleLength(str) {
  return str.replace(ANSI_RE, '').length;
}
function padVisible(str, width) {
  const pad = Math.max(0, width - visibleLength(str));
  return str + ' '.repeat(pad);
}

function renderTwoColumnRows(leftCol, rightCol, leftWidth) {
  const rows = [];
  const height = Math.max(leftCol.length, rightCol.length);
  for (let i = 0; i < height; i++) {
    const l = leftCol[i] || '';
    const r = rightCol[i] || '';
    rows.push(r ? `${padVisible(l, leftWidth)}  ${r}` : l);
  }
  return rows.join('\n');
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
    const paletteName = options.artStyle === 'retro' ? 'retro' : isDay ? 'day' : 'night';
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
  const wind = `${formatWindSpeed(weather.wind.speed, displayUnit, windUnit)} @ ${weather.wind.deg}°${windGust}`;
  const visFormatted = formatVisibility(weather.visibility, displayUnit);

  const left = [
    chalk.gray(weather.weather[0].description),
    formatTemp(weather.main.temp, displayUnit, { colorCode: true, type: 'current' }),
    `Feels like: ${formatTemp(weather.main.feels_like, displayUnit)}`,
    `Humidity:   ${weather.main.humidity}%`,
    `Pressure:   ${weather.main.pressure} hPa`
  ];

  const right = [
    `Sunrise:     ${formatTime(weather.sys.sunrise)}`,
    `Sunset:      ${formatTime(weather.sys.sunset)}`,
    aqi ? `Air Quality: ${getAirQualityDescription(aqi)} (AQI: ${aqi})` : '',
    `Min/Max:     ${formatTemp(weather.main.temp_min, displayUnit, { colorCode: true, type: 'min' })} / ${formatTemp(weather.main.temp_max, displayUnit, { colorCode: true, type: 'max' })}`,
    `Wind:        ${wind}`,
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

  const forecastLines = Object.entries(dailyData)
    .slice(0, 5)
    .map(([_, info]) => {
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

      return `${emoji} ${dayLabel.padEnd(4)} ${temps}`;
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
  const content = renderedSpark || renderForecastList(next24Hours, displayUnit);

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
      return `${time.padEnd(6)} ${emoji} ${temp.padEnd(6)} ${chalk.gray(item.weather[0].description)}`;
    })
    .join('\n');
}

export {
  formatTemp,
  formatWindSpeed,
  formatVisibility,
  formatTime,
  getAirQualityDescription,
  displayCurrentWeather,
  display5DayForecast,
  display24HourForecast,
  createDataRow
};
