import { describe, it, expect } from 'vitest';
import {
  formatTemp,
  formatWindSpeed,
  formatTime,
  getAirQualityDescription,
  createDataRow
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
