import { describe, it, expect } from 'vitest';
import {
  sanitizeLocation,
  validateLocation,
  validateCoordinates
} from '../../src/utils/validators.js';

describe('sanitizeLocation', () => {
  it('removes unsafe characters', () => {
    expect(sanitizeLocation('New York<script>')).toBe('New Yorkscript');
    expect(sanitizeLocation('London"s')).toBe('Londons');
    expect(sanitizeLocation("Tokyo's")).toBe('Tokyos');
  });

  it('trims whitespace', () => {
    expect(sanitizeLocation('  Tokyo  ')).toBe('Tokyo');
  });

  it('truncates to max length', () => {
    const longInput = 'A'.repeat(200);
    expect(sanitizeLocation(longInput).length).toBe(100);
  });

  it('throws on non-string input', () => {
    expect(() => sanitizeLocation(123)).toThrow('Location must be a string');
    expect(() => sanitizeLocation(null)).toThrow('Location must be a string');
    expect(() => sanitizeLocation(undefined)).toThrow('Location must be a string');
  });
});

describe('validateLocation', () => {
  it('returns sanitized location for plain text', () => {
    expect(validateLocation('London')).toBe('London');
  });

  it('passes state codes through unchanged for geocoder disambiguation', () => {
    // "San Ramon, CA" stays as-is so parseLocationQuery can extract admin1: 'CA'
    // Rewriting to "San Ramon, US" would strip state-level disambiguation
    expect(validateLocation('San Ramon, CA')).toBe('San Ramon, CA');
    expect(validateLocation('New York, NY')).toBe('New York, NY');
  });

  it('passes country codes through as-is', () => {
    expect(validateLocation('London, UK')).toBe('London, UK');
  });

  it('preserves multi-part locations', () => {
    expect(validateLocation('San Ramon, CA, US')).toBe('San Ramon, CA, US');
  });

  it('throws on empty location', () => {
    expect(() => validateLocation('')).toThrow('Location cannot be empty');
    expect(() => validateLocation('   ')).toThrow('Location cannot be empty');
  });

  it('throws on non-string input', () => {
    expect(() => validateLocation(42)).toThrow('Location must be a string');
  });
});

describe('validateCoordinates', () => {
  it('validates and returns parsed coordinates', () => {
    const result = validateCoordinates(40.7128, -74.006);
    expect(result.latitude).toBe(40.7128);
    expect(result.longitude).toBe(-74.006);
  });

  it('accepts string coordinates', () => {
    const result = validateCoordinates('40.7128', '-74.006');
    expect(result.latitude).toBe(40.7128);
    expect(result.longitude).toBe(-74.006);
  });

  it('throws on invalid latitude (>90)', () => {
    expect(() => validateCoordinates(91, 0)).toThrow('Invalid latitude');
  });

  it('throws on invalid latitude (<-90)', () => {
    expect(() => validateCoordinates(-91, 0)).toThrow('Invalid latitude');
  });

  it('throws on invalid longitude (>180)', () => {
    expect(() => validateCoordinates(0, 181)).toThrow('Invalid longitude');
  });

  it('throws on invalid longitude (<-180)', () => {
    expect(() => validateCoordinates(0, -181)).toThrow('Invalid longitude');
  });

  it('throws on NaN input', () => {
    expect(() => validateCoordinates('abc', 'def')).toThrow('must be numbers');
  });

  it('accepts boundary values', () => {
    expect(validateCoordinates(90, 180)).toEqual({ latitude: 90, longitude: 180 });
    expect(validateCoordinates(-90, -180)).toEqual({ latitude: -90, longitude: -180 });
  });
});
