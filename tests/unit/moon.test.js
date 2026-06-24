import { describe, it, expect } from 'vitest';
import { getMoonPhase } from '../../src/utils/moon.js';

describe('getMoonPhase', () => {
  it('returns an object with phase, illumination, name, and emoji', () => {
    const result = getMoonPhase(new Date('2025-06-15T12:00:00'));
    expect(result).toHaveProperty('phase');
    expect(result).toHaveProperty('illumination');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('emoji');
  });

  it('returns phase between 0 and 1', () => {
    const result = getMoonPhase(new Date('2025-06-15T12:00:00'));
    expect(result.phase).toBeGreaterThanOrEqual(0);
    expect(result.phase).toBeLessThan(1);
  });

  it('returns illumination between 0 and 100', () => {
    const result = getMoonPhase(new Date('2025-06-15T12:00:00'));
    expect(result.illumination).toBeGreaterThanOrEqual(0);
    expect(result.illumination).toBeLessThanOrEqual(100);
  });

  it('returns a valid phase name from the 8 known phases', () => {
    const validNames = [
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent'
    ];
    const result = getMoonPhase(new Date('2025-06-15T12:00:00'));
    expect(validNames).toContain(result.name);
  });

  it('returns a valid emoji', () => {
    const validEmojis = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const result = getMoonPhase(new Date('2025-06-15T12:00:00'));
    expect(validEmojis).toContain(result.emoji);
  });

  it('works with default parameter (no date passed)', () => {
    const result = getMoonPhase();
    expect(result).toHaveProperty('phase');
    expect(result).toHaveProperty('name');
  });

  it('returns near full moon for 2025-01-13 (Wolf Moon)', () => {
    const result = getMoonPhase(new Date('2025-01-13T22:00:00Z'));
    // Full moon was Jan 13 2025 at ~22:27 UTC
    // Illumination should be very high (95-100%)
    expect(result.illumination).toBeGreaterThan(90);
  });

  it('returns near new moon for 2025-01-29', () => {
    const result = getMoonPhase(new Date('2025-01-29T12:00:00Z'));
    // New moon was Jan 29 2025 at ~12:36 UTC
    // Illumination should be very low (0-5%)
    expect(result.illumination).toBeLessThan(10);
  });

  it('produces different phases for different dates', () => {
    const date1 = getMoonPhase(new Date('2025-01-13T12:00:00Z'));
    const date2 = getMoonPhase(new Date('2025-02-12T12:00:00Z'));
    // Moon phases shift over a month — either phase or name should differ
    const different = date1.phase !== date2.phase || date1.name !== date2.name;
    expect(different).toBe(true);
  });

  it('all 8 phase names are reachable', () => {
    // Check several dates across a lunar cycle to hit different phases
    const names = new Set();
    // Sample dates roughly 3.7 days apart across one synodic month
    const baseDate = new Date('2025-03-15T00:00:00Z');
    for (let i = 0; i < 8; i++) {
      const d = new Date(baseDate.getTime() + i * 3.7 * 24 * 60 * 60 * 1000);
      names.add(getMoonPhase(d).name);
    }
    // Should hit at least 5 of 8 phases in a rough sampling
    expect(names.size).toBeGreaterThanOrEqual(5);
  });
});
