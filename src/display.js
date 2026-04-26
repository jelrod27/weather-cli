import chalk from 'chalk';
import boxen from 'boxen';
import { getScene, isDaytime } from './ascii/index.js';
import { AsciiRenderer } from './ascii/renderer.js';

const weatherEmojis = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  Mist: '🌫️',
  Fog: '🌫️',
  Haze: '🌫️'
};

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

function formatWindSpeed(speed, displayUnit) {
  if (displayUnit === 'fahrenheit') {
    const mph = speed * 2.237;
    return `${mph.toFixed(1)} mph`;
  }
  return `${speed} m/s`;
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
    ? ` (gust ${formatWindSpeed(weather.wind.gust, displayUnit)})`
    : '';
  const wind = `${formatWindSpeed(weather.wind.speed, displayUnit)} @ ${weather.wind.deg}°${windGust}`;
  const visKm = (weather.visibility / 1000).toFixed(1);

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
    `Visibility:  ${visKm} km`
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

function display24HourForecast(data, displayUnit) {
  const next24Hours = data.forecast.list.slice(0, 8);

  const forecastLines = next24Hours.map((item) => {
    const time = new Date(item.dt * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true
    });
    const emoji = weatherEmojis[item.weather[0].main] || '🌤️';
    const temp = formatTemp(item.main.temp, displayUnit);

    return `${time.padEnd(6)} ${emoji} ${temp.padEnd(6)} ${chalk.gray(item.weather[0].description)}`;
  });

  console.log(
    boxen(forecastLines.join('\n'), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: 0,
      borderStyle: 'round',
      borderColor: 'blue'
    })
  );
}

export {
  formatTemp,
  formatTime,
  getAirQualityDescription,
  displayCurrentWeather,
  display5DayForecast,
  display24HourForecast,
  createDataRow
};
