import { describe, it, expect, vi } from 'vitest';
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
  createDataRow,
  displayAlerts,
  displayMinutelyForecast,
  displayCurrentWeather
} from '../../src/display.js';

describe('formatTemp', () => {
  it('formats Celsius temperature', () => {
    expect(formatTemp(20.4, 'celsius')).toBe('20°C');
  });

  it('formats Fahrenheit temperature', () => {
    expect(formatTemp(68.9, 'fahrenheit')).toBe('69°F');
  });

  it('rounds to nearest integer', () => {
    expect(formatTemp(20.5, 'celsius')).toBe('21°C');
    expect(formatTemp(20.4, 'celsius')).toBe('20°C');
  });

  it('handles negative temperatures', () => {
    expect(formatTemp(-5.3, 'celsius')).toBe('-5°C');
  });

  it('handles zero', () => {
    expect(formatTemp(0, 'celsius')).toBe('0°C');
  });
});

describe('formatWindSpeed', () => {
  it('formats metric wind speed with 1 decimal place', () => {
    expect(formatWindSpeed(3.7, 'celsius', 'ms')).toBe('3.7 m/s');
  });

  it('avoids floating point noise in metric display', () => {
    // Value like 3.700000000000001 should render as "3.7 m/s"
    expect(formatWindSpeed(3.700000000000001, 'celsius', 'ms')).toBe('3.7 m/s');
  });

  it('formats whole number metric wind speed with 1 decimal', () => {
    expect(formatWindSpeed(5, 'celsius', 'ms')).toBe('5.0 m/s');
  });

  it('formats mph wind speed from API with 1 decimal', () => {
    expect(formatWindSpeed(10.5, 'celsius', 'mph')).toBe('10.5 mph');
  });

  it('converts m/s to mph for fahrenheit display unit', () => {
    const result = formatWindSpeed(10, 'fahrenheit', 'ms');
    // 10 m/s * 2.237 = 22.37 mph, toFixed(1) = "22.4 mph"
    expect(result).toBe('22.4 mph');
  });

  it('does NOT double-convert when API already returns mph (windUnit=mph, fahrenheit)', () => {
    // This is the core bug scenario: Open-Meteo returns mph already when imperial
    // is selected. formatWindSpeed must skip the m/s->mph conversion.
    const result = formatWindSpeed(10, 'fahrenheit', 'mph');
    expect(result).toBe('10.0 mph');
  });

  it('does NOT double-convert gust speed either (windUnit=mph)', () => {
    const result = formatWindSpeed(25.3, 'fahrenheit', 'mph');
    expect(result).toBe('25.3 mph');
  });
});

describe('formatVisibility', () => {
  it('formats meters as km for celsius display', () => {
    expect(formatVisibility(10000, 'celsius')).toBe('10.0 km');
  });

  it('formats meters as miles for fahrenheit display', () => {
    // 10000m / 1609.344 = 6.21371... miles
    expect(formatVisibility(10000, 'fahrenheit')).toBe('6.2 mi');
  });

  it('formats low visibility correctly', () => {
    expect(formatVisibility(2000, 'celsius')).toBe('2.0 km');
    expect(formatVisibility(2000, 'fahrenheit')).toBe('1.2 mi');
  });
});

describe('formatTime', () => {
  it('formats a Unix timestamp to locale time string', () => {
    // Use a known timestamp: 2024-01-01 12:00:00 UTC = 1704110400
    const result = formatTime(1704110400);
    // Just verify it returns a string with AM/PM format
    expect(result).toMatch(/\d{2}:\d{2}\s*(AM|PM)/);
  });
});

describe('getAirQualityDescription', () => {
  it('returns "Good" for AQI 1', () => {
    const result = getAirQualityDescription(1);
    // The result includes chalk color codes, so check the underlying text
    expect(result).toContain('Good');
  });

  it('returns "Fair" for AQI 2', () => {
    expect(getAirQualityDescription(2)).toContain('Fair');
  });

  it('returns "Moderate" for AQI 3', () => {
    expect(getAirQualityDescription(3)).toContain('Moderate');
  });

  it('returns "Poor" for AQI 4', () => {
    expect(getAirQualityDescription(4)).toContain('Poor');
  });

  it('returns "Very Poor" for AQI 5', () => {
    expect(getAirQualityDescription(5)).toContain('Very Poor');
  });

  it('returns "Unknown" for invalid AQI', () => {
    expect(getAirQualityDescription(99)).toContain('Unknown');
  });
});

describe('createDataRow', () => {
  it('creates a padded row with label and value', () => {
    const row = createDataRow('Temp:', '20°C', { labelWidth: 10 });
    expect(row).toContain('Temp:');
    expect(row).toContain('20°C');
  });

  it('includes icon when provided', () => {
    const row = createDataRow('Wind:', '5 m/s', { icon: '💨', labelWidth: 10 });
    expect(row).toContain('💨');
    expect(row).toContain('Wind:');
  });

  it('uses default label width when not specified', () => {
    const row = createDataRow('Label:', 'Value');
    expect(row).toContain('Label:');
    expect(row).toContain('Value');
  });
});

describe('displayAlerts', () => {
  it('returns empty string when alerts array is empty', () => {
    expect(displayAlerts([])).toBe('');
  });

  it('returns empty string when alerts is null or undefined', () => {
    expect(displayAlerts(null)).toBe('');
    expect(displayAlerts(undefined)).toBe('');
  });

  it('returns a string containing alert headline for a severe alert', () => {
    const alerts = [
      {
        headline: 'Severe Thunderstorm Warning',
        severity: 'Severe',
        urgency: 'Immediate',
        description: 'A severe thunderstorm is expected.',
        event: 'Severe Thunderstorm Warning'
      }
    ];
    const result = displayAlerts(alerts);
    expect(result).toContain('Severe Thunderstorm Warning');
    expect(result).not.toBe('');
  });

  it('returns a string for an extreme alert', () => {
    const alerts = [
      {
        headline: 'Tornado Warning',
        severity: 'Extreme',
        urgency: 'Immediate',
        description: 'Tornado spotted.',
        event: 'Tornado Warning'
      }
    ];
    const result = displayAlerts(alerts);
    expect(result).toContain('Tornado Warning');
  });

  it('includes description snippet when description exists', () => {
    const alerts = [
      {
        headline: 'Flood Advisory',
        severity: 'Minor',
        urgency: 'Expected',
        description: 'Flooding is possible in low-lying areas.',
        event: 'Flood Advisory'
      }
    ];
    const result = displayAlerts(alerts);
    expect(result).toContain('Flood Advisory');
  });
});

describe('formatRelativeTime', () => {
  const now = Math.floor(Date.now() / 1000);

  it('returns "in Xm" for a few minutes in the future', () => {
    const result = formatRelativeTime(now + 180); // 3 minutes from now
    expect(result).toMatch(/^in \d+m$/);
  });

  it('returns "in Xh Ym" for hours and minutes in the future', () => {
    const result = formatRelativeTime(now + 3 * 3600 + 22 * 60); // 3h 22m from now
    expect(result).toMatch(/^in \d+h \d+m$/);
  });

  it('returns "Xm ago" for a recent past timestamp', () => {
    const result = formatRelativeTime(now - 5 * 60); // 5 minutes ago
    expect(result).toMatch(/^\d+m ago$/);
  });

  it('returns "Xh Ym ago" for a past timestamp hours ago', () => {
    const result = formatRelativeTime(now - 2 * 3600 - 15 * 60); // 2h 15m ago
    expect(result).toMatch(/^\d+h \d+m ago$/);
  });

  it('returns "in 0m" for right now', () => {
    const result = formatRelativeTime(now);
    expect(result).toMatch(/^in \d+m$/);
  });

  it('returns "in Xm" for one minute in the future', () => {
    const result = formatRelativeTime(now + 60);
    expect(result).toMatch(/^in \d+m$/);
  });
});

describe('degToCardinal', () => {
  it('returns N for 0 degrees', () => {
    expect(degToCardinal(0)).toBe('N');
  });
  it('returns NE for 45 degrees', () => {
    expect(degToCardinal(45)).toBe('NE');
  });
  it('returns E for 90 degrees', () => {
    expect(degToCardinal(90)).toBe('E');
  });
  it('returns S for 180 degrees', () => {
    expect(degToCardinal(180)).toBe('S');
  });
  it('returns W for 270 degrees', () => {
    expect(degToCardinal(270)).toBe('W');
  });
  it('handles negative degrees', () => {
    expect(degToCardinal(-90)).toBe('W');
  });
  it('handles degrees over 360', () => {
    expect(degToCardinal(370)).toBe('N');
  });
});

describe('displayMinutelyForecast', () => {
  it('outputs a message when no minutely data is available', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayMinutelyForecast({}, 'celsius');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    expect(output).toContain('No minutely precipitation data');
    spy.mockRestore();
  });

  it('outputs a message when minutely has no precipitation array', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayMinutelyForecast({ minutely: { time: [] } }, 'celsius');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    expect(output).toContain('No minutely precipitation data');
    spy.mockRestore();
  });

  it('renders a chart when minutely precipitation data is present', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayMinutelyForecast(
      {
        minutely: {
          time: ['2026-05-29T12:00', '2026-05-29T12:15', '2026-05-29T12:30', '2026-05-29T12:45'],
          precipitation: [0, 0.5, 1.2, 0.3]
        }
      },
      'celsius'
    );
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    // Box title should reference precipitation
    expect(output).toContain('Precipitation next hour');
    // Should show peak info
    expect(output).toContain('Peak');
    spy.mockRestore();
  });

  it('renders "No rain next hour" when all precipitation values are zero', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayMinutelyForecast(
      {
        minutely: {
          time: ['2026-05-29T12:00', '2026-05-29T12:15', '2026-05-29T12:30', '2026-05-29T12:45'],
          precipitation: [0, 0, 0, 0]
        }
      },
      'celsius'
    );
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    expect(output).toContain('No rain next hour');
    expect(output).toContain('No precipitation expected');
    spy.mockRestore();
  });

  it('renders with a single data point without crashing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayMinutelyForecast(
      {
        minutely: {
          time: ['2026-05-29T12:00'],
          precipitation: [2.5]
        }
      },
      'celsius'
    );
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    expect(output).toContain('Peak');
    spy.mockRestore();
  });

  it('works with fahrenheit display unit (unit does not affect precipitation)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayMinutelyForecast(
      {
        minutely: {
          time: ['2026-05-29T12:00', '2026-05-29T12:15'],
          precipitation: [0.1, 1.0]
        }
      },
      'fahrenheit'
    );
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    expect(output).toContain('Precipitation next hour');
    spy.mockRestore();
  });
});

describe('formatFeelsLike', () => {
  it('formats dual units in fahrenheit mode', () => {
    expect(formatFeelsLike(72, 'fahrenheit')).toBe('72\u00b0F / 22\u00b0C');
  });

  it('formats dual units in celsius mode', () => {
    expect(formatFeelsLike(22, 'celsius')).toBe('22\u00b0C / 72\u00b0F');
  });

  it('handles negative temperatures in fahrenheit mode', () => {
    expect(formatFeelsLike(-4, 'fahrenheit')).toBe('-4\u00b0F / -20\u00b0C');
  });

  it('handles zero temperature', () => {
    expect(formatFeelsLike(0, 'celsius')).toBe('0\u00b0C / 32\u00b0F');
  });

  it('returns N/A for null', () => {
    expect(formatFeelsLike(null, 'fahrenheit')).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatFeelsLike(undefined, 'celsius')).toBe('N/A');
  });

  it('returns N/A for NaN', () => {
    expect(formatFeelsLike(NaN, 'fahrenheit')).toBe('N/A');
  });
});

describe('formatTemp null handling', () => {
  it('returns N/A for null', () => {
    expect(formatTemp(null, 'celsius')).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatTemp(undefined, 'fahrenheit')).toBe('N/A');
  });

  it('returns N/A for NaN', () => {
    expect(formatTemp(NaN, 'celsius')).toBe('N/A');
  });
});

describe('formatUvIndex', () => {
  it('returns "N/A" for null', () => {
    expect(formatUvIndex(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatUvIndex(undefined)).toBe('N/A');
  });

  it('returns "N/A" for NaN', () => {
    expect(formatUvIndex(NaN)).toBe('N/A');
  });

  it('returns Low for value 0', () => {
    expect(formatUvIndex(0)).toBe('0 (Low)');
  });

  it('returns Low for value 1', () => {
    expect(formatUvIndex(1)).toBe('1 (Low)');
  });

  it('returns Low for value 2', () => {
    expect(formatUvIndex(2)).toBe('2 (Low)');
  });

  it('returns Moderate for value 3', () => {
    expect(formatUvIndex(3)).toBe('3 (Moderate)');
  });

  it('returns Moderate for value 5', () => {
    expect(formatUvIndex(5)).toBe('5 (Moderate)');
  });

  it('returns High for value 6', () => {
    expect(formatUvIndex(6)).toBe('6 (High)');
  });

  it('returns High for value 7', () => {
    expect(formatUvIndex(7)).toBe('7 (High)');
  });

  it('returns Very High for value 8', () => {
    expect(formatUvIndex(8)).toBe('8 (Very High)');
  });

  it('returns Very High for value 10', () => {
    expect(formatUvIndex(10)).toBe('10 (Very High)');
  });

  it('returns Extreme for value 11', () => {
    expect(formatUvIndex(11)).toBe('11 (Extreme)');
  });

  it('returns Extreme for value 15', () => {
    expect(formatUvIndex(15)).toBe('15 (Extreme)');
  });

  it('handles decimal values', () => {
    expect(formatUvIndex(7.4)).toBe('7.4 (High)');
  });

  it('handles decimal value in Moderate range', () => {
    expect(formatUvIndex(4.5)).toBe('4.5 (Moderate)');
  });

  it('handles decimal value in Very High range', () => {
    expect(formatUvIndex(9.3)).toBe('9.3 (Very High)');
  });
});

describe('formatDewPoint', () => {
  it('returns "N/A" for null', () => {
    expect(formatDewPoint(null, 'celsius')).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatDewPoint(undefined, 'celsius')).toBe('N/A');
  });

  it('returns "N/A" for NaN', () => {
    expect(formatDewPoint(NaN, 'celsius')).toBe('N/A');
  });

  it('returns Dry for value below 12.8 C', () => {
    expect(formatDewPoint(10, 'celsius')).toBe('10°C (Dry)');
  });

  it('returns Dry for 12 C (below 12.8 threshold)', () => {
    expect(formatDewPoint(12, 'celsius')).toBe('12°C (Dry)');
  });

  it('returns Comfortable for 14 C', () => {
    expect(formatDewPoint(14, 'celsius')).toBe('14°C (Comfortable)');
  });

  it('returns Sticky for 17 C', () => {
    expect(formatDewPoint(17, 'celsius')).toBe('17°C (Sticky)');
  });

  it('returns Uncomfortable for 20 C', () => {
    expect(formatDewPoint(20, 'celsius')).toBe('20°C (Uncomfortable)');
  });

  it('returns Oppressive for 22 C', () => {
    expect(formatDewPoint(22, 'celsius')).toBe('22°C (Oppressive)');
  });

  it('returns Severe for 25 C', () => {
    expect(formatDewPoint(25, 'celsius')).toBe('25°C (Severe)');
  });

  it('converts to fahrenheit correctly', () => {
    expect(formatDewPoint(12, 'fahrenheit')).toBe('54°F (Dry)');
  });

  it('converts to fahrenheit for Sticky range', () => {
    expect(formatDewPoint(17, 'fahrenheit')).toBe('63°F (Sticky)');
  });

  it('converts to fahrenheit for Severe range', () => {
    expect(formatDewPoint(25, 'fahrenheit')).toBe('77°F (Severe)');
  });

  it('handles decimal values in celsius', () => {
    expect(formatDewPoint(13.5, 'celsius')).toBe('14°C (Comfortable)');
  });

  it('handles decimal values in fahrenheit', () => {
    expect(formatDewPoint(15.6, 'fahrenheit')).toBe('60°F (Sticky)');
  });

  it('respects boundary: 12.8 is Comfortable not Dry', () => {
    expect(formatDewPoint(12.8, 'celsius')).toBe('13°C (Comfortable)');
  });

  it('respects boundary: 23.9 is Severe not Oppressive', () => {
    expect(formatDewPoint(23.9, 'celsius')).toBe('24°C (Severe)');
  });
});

describe('displayCurrentWeather - Cloud Cover', () => {
  it('displays Cloud Cover in the output', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const data = {
      current: {
        name: 'Test City',
        sys: { country: 'US', sunrise: 1700000000, sunset: 1700040000 },
        main: {
          temp: 72,
          feels_like: 70,
          humidity: 55,
          pressure: 1015,
          temp_min: 52,
          temp_max: 76
        },
        wind: { speed: 5, deg: 270, gust: 9 },
        weather: [{ id: 802, main: 'Clouds', description: 'partly cloudy' }],
        uv_index: 5,
        visibility: 12000,
        dew_point: 14,
        cloud_cover: 40
      },
      pollution: { list: [{ main: { aqi: 1 } }] },
      windUnit: 'ms'
    };
    displayCurrentWeather(data, 'celsius');
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    expect(output).toContain('Cloud Cover');
    expect(output).toContain('40%');
    spy.mockRestore();
  });

  it('displays N/A for Cloud Cover when null', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const data = {
      current: {
        name: 'Test City',
        sys: { country: 'US', sunrise: 1700000000, sunset: 1700040000 },
        main: {
          temp: 72,
          feels_like: 70,
          humidity: 55,
          pressure: 1015,
          temp_min: 52,
          temp_max: 76
        },
        wind: { speed: 5, deg: 270, gust: 9 },
        weather: [{ id: 802, main: 'Clouds', description: 'partly cloudy' }],
        uv_index: 5,
        visibility: 12000,
        dew_point: 14,
        cloud_cover: null
      },
      pollution: { list: [{ main: { aqi: 1 } }] },
      windUnit: 'ms'
    };
    displayCurrentWeather(data, 'celsius');
    const output = spy.mock.calls.map((args) => args.join('')).join('\n');
    expect(output).toContain('Cloud Cover');
    expect(output).toContain('N/A%');
    spy.mockRestore();
  });
});

describe('formatPrecipProbability', () => {
  it('returns "N/A" for null', () => {
    expect(formatPrecipProbability(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatPrecipProbability(undefined)).toBe('N/A');
  });

  it('returns "N/A" for NaN', () => {
    expect(formatPrecipProbability(NaN)).toBe('N/A');
  });

  it('returns value as string for 0', () => {
    expect(formatPrecipProbability(0)).toBe('0');
  });

  it('returns value as string for 30', () => {
    expect(formatPrecipProbability(30)).toBe('30');
  });

  it('returns value as string for 100', () => {
    expect(formatPrecipProbability(100)).toBe('100');
  });
});

describe('formatWindDescription', () => {
  it('returns "N/A" for null', () => {
    expect(formatWindDescription(null, 'ms')).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatWindDescription(undefined, 'ms')).toBe('N/A');
  });

  it('returns "N/A" for NaN', () => {
    expect(formatWindDescription(NaN, 'ms')).toBe('N/A');
  });

  it('returns Calm for 0 m/s', () => {
    expect(formatWindDescription(0, 'ms')).toBe('Calm');
  });

  it('returns Light air for 1 m/s', () => {
    expect(formatWindDescription(1, 'ms')).toBe('Light air');
  });

  it('returns Light breeze for 2 m/s', () => {
    expect(formatWindDescription(2, 'ms')).toBe('Light breeze');
  });

  it('returns Gentle breeze for 4 m/s', () => {
    expect(formatWindDescription(4, 'ms')).toBe('Gentle breeze');
  });

  it('returns Moderate breeze for 6 m/s', () => {
    expect(formatWindDescription(6, 'ms')).toBe('Moderate breeze');
  });

  it('returns Fresh breeze for 9 m/s', () => {
    expect(formatWindDescription(9, 'ms')).toBe('Fresh breeze');
  });

  it('returns Strong breeze for 12 m/s', () => {
    expect(formatWindDescription(12, 'ms')).toBe('Strong breeze');
  });

  it('returns High wind for 15 m/s', () => {
    expect(formatWindDescription(15, 'ms')).toBe('High wind');
  });

  it('returns Gale for 19 m/s', () => {
    expect(formatWindDescription(19, 'ms')).toBe('Gale');
  });

  it('returns Strong gale for 23 m/s', () => {
    expect(formatWindDescription(23, 'ms')).toBe('Strong gale');
  });

  it('returns Storm for 27 m/s', () => {
    expect(formatWindDescription(27, 'ms')).toBe('Storm');
  });

  it('returns Violent storm for 30 m/s', () => {
    expect(formatWindDescription(30, 'ms')).toBe('Violent storm');
  });

  it('returns Hurricane for 33 m/s', () => {
    expect(formatWindDescription(33, 'ms')).toBe('Hurricane');
  });

  it('converts mph to m/s correctly (10 mph = Gentle breeze)', () => {
    expect(formatWindDescription(10, 'mph')).toBe('Gentle breeze');
  });

  it('converts kn to m/s correctly (10 kn = Gentle breeze)', () => {
    expect(formatWindDescription(10, 'kn')).toBe('Gentle breeze');
  });
});

describe('formatDaylight', () => {
  it('returns "N/A" for null sunrise', () => {
    expect(formatDaylight(null, 1700030000)).toBe('N/A');
  });

  it('returns "N/A" for null sunset', () => {
    expect(formatDaylight(1699990000, null)).toBe('N/A');
  });

  it('returns "N/A" for both null', () => {
    expect(formatDaylight(null, null)).toBe('N/A');
  });

  it('returns "N/A" for undefined sunrise', () => {
    expect(formatDaylight(undefined, 1700030000)).toBe('N/A');
  });

  it('returns "N/A" for NaN sunrise', () => {
    expect(formatDaylight(NaN, 1700030000)).toBe('N/A');
  });

  it('calculates daylight duration correctly (11h 6m)', () => {
    expect(formatDaylight(1699990000, 1700030000)).toBe('11h 6m');
  });

  it('returns 0h 0m when sunrise equals sunset', () => {
    expect(formatDaylight(1699990000, 1699990000)).toBe('0h 0m');
  });

  it('returns "N/A" for negative duration (sunset before sunrise)', () => {
    expect(formatDaylight(1700030000, 1699990000)).toBe('N/A');
  });
});

describe('formatPressureTrend', () => {
  it('returns empty string for null trend', () => {
    expect(formatPressureTrend(null, 1.0)).toBe('');
  });

  it('returns empty string for undefined trend', () => {
    expect(formatPressureTrend(undefined, 1.0)).toBe('');
  });

  it('returns blue rising indicator for rising trend', () => {
    const result = formatPressureTrend('rising', 2.1);
    expect(result).toContain('↑');
    expect(result).toContain('+2.1');
  });

  it('returns red falling indicator for falling trend', () => {
    const result = formatPressureTrend('falling', -3.2);
    expect(result).toContain('↓');
    expect(result).toContain('3.2');
  });

  it('returns gray steady indicator for steady trend', () => {
    const result = formatPressureTrend('steady', 0.1);
    expect(result).toContain('→');
    expect(result).toContain('0.1');
  });

  it('uses absolute value for delta display', () => {
    const rising = formatPressureTrend('rising', 5.0);
    expect(rising).toContain('+5.0');
    const falling = formatPressureTrend('falling', -5.0);
    expect(falling).toContain('5.0');
  });
});

describe('formatMoonPhase', () => {
  it('returns N/A for null input', () => {
    expect(formatMoonPhase(null)).toBe('N/A');
  });

  it('returns N/A for undefined input', () => {
    expect(formatMoonPhase(undefined)).toBe('N/A');
  });

  it('formats a valid moon phase object', () => {
    const moonData = { emoji: '🌕', name: 'Full Moon', illumination: 100, phase: 0.5 };
    const result = formatMoonPhase(moonData);
    expect(result).toContain('Full Moon');
    expect(result).toContain('100%');
    expect(result).toContain('illuminated');
  });

  it('formats a crescent moon correctly', () => {
    const moonData = { emoji: '🌒', name: 'Waxing Crescent', illumination: 15, phase: 0.0625 };
    const result = formatMoonPhase(moonData);
    expect(result).toContain('Waxing Crescent');
    expect(result).toContain('15%');
  });
});

describe('formatCape', () => {
  it('returns "N/A" for null', () => {
    expect(formatCape(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatCape(undefined)).toBe('N/A');
  });

  it('returns "N/A" for NaN', () => {
    expect(formatCape(NaN)).toBe('N/A');
  });

  it('returns none for negative values', () => {
    expect(formatCape(-100)).toBe('0 J/kg (none)');
  });

  it('returns low for value 0', () => {
    expect(formatCape(0)).toContain('0 J/kg (low)');
  });

  it('returns low for value 500', () => {
    expect(formatCape(500)).toContain('500 J/kg (low)');
  });

  it('returns low for value 999', () => {
    expect(formatCape(999)).toContain('999 J/kg (low)');
  });

  it('returns moderate for value 1000', () => {
    expect(formatCape(1000)).toContain('1000 J/kg (moderate)');
  });

  it('returns moderate for value 1500', () => {
    expect(formatCape(1500)).toContain('1500 J/kg (moderate)');
  });

  it('returns moderate for value 2499', () => {
    expect(formatCape(2499)).toContain('2499 J/kg (moderate)');
  });

  it('returns high for value 2500', () => {
    expect(formatCape(2500)).toContain('2500 J/kg (high)');
  });

  it('returns high for value 3999', () => {
    expect(formatCape(3999)).toContain('3999 J/kg (high)');
  });

  it('returns extreme for value 4000', () => {
    expect(formatCape(4000)).toContain('4000 J/kg (extreme)');
  });

  it('returns extreme for value 5000', () => {
    expect(formatCape(5000)).toContain('5000 J/kg (extreme)');
  });

  it('rounds decimal values', () => {
    expect(formatCape(1499.6)).toContain('1500 J/kg (moderate)');
  });
});
