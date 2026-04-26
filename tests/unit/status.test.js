import { describe, it, expect } from 'vitest';
import { formatStatus } from '../../src/commands/status.js';

const ANSI = /\x1b\[[0-9;]*m/g;
const strip = (s) => s.replace(ANSI, '');

const sampleData = {
  current: {
    name: 'San Ramon',
    weather: [{ main: 'Clear' }],
    main: { temp: 82.4, temp_min: 73.1, temp_max: 88.6 }
  },
  displayUnit: 'fahrenheit'
};

describe('formatStatus', () => {
  it('default format includes icon, name, temp, hi/lo', () => {
    const out = strip(formatStatus(sampleData));
    expect(out).toContain('San Ramon');
    expect(out).toContain('82°F');
    expect(out).toContain('↑89');
    expect(out).toContain('↓73');
    expect(out).toContain('☀️');
  });

  it('compact format drops the name and hi/lo', () => {
    const out = strip(formatStatus(sampleData, { format: 'compact' }));
    expect(out).toBe('☀️ 82°F');
  });

  it('minimal format is temp only', () => {
    const out = strip(formatStatus(sampleData, { format: 'minimal' }));
    expect(out).toBe('82°F');
  });

  it('--no-emoji strips the icon in default format', () => {
    const out = strip(formatStatus(sampleData, { noEmoji: true }));
    expect(out).not.toContain('☀️');
    expect(out).toContain('San Ramon');
    expect(out.startsWith('San Ramon')).toBe(true);
  });

  it('handles celsius', () => {
    const c = {
      ...sampleData,
      displayUnit: 'celsius',
      current: { ...sampleData.current, main: { temp: 20.4, temp_min: 15, temp_max: 25 } }
    };
    const out = strip(formatStatus(c));
    expect(out).toContain('20°C');
  });

  it('falls back to generic icon for unknown weather', () => {
    const unknown = {
      ...sampleData,
      current: { ...sampleData.current, weather: [{ main: 'Tornado' }] }
    };
    const out = strip(formatStatus(unknown));
    expect(out).toContain('🌤️');
  });

  it('reads data from root shape too (no nested .current)', () => {
    const flat = {
      name: 'London',
      weather: [{ main: 'Rain' }],
      main: { temp: 12, temp_min: 10, temp_max: 15 },
      displayUnit: 'celsius'
    };
    const out = strip(formatStatus(flat));
    expect(out).toContain('London');
    expect(out).toContain('12°C');
    expect(out).toContain('🌧️');
  });
});
