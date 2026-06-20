import { describe, it, expect } from 'vitest';
import { parseLocation } from '../../src/utils/locationParser.js';

describe('parseLocation', () => {
  describe('basic joining', () => {
    it('joins multiple words into a location string', () => {
      expect(parseLocation(['San', 'Ramon', 'CA'])).toBe('San Ramon CA');
    });

    it('returns single-word locations as-is', () => {
      expect(parseLocation(['London'])).toBe('London');
    });

    it('returns plain text for unrecognized single-word locations', () => {
      expect(parseLocation(['Timbuktu'])).toBe('Timbuktu');
    });
  });

  describe('option filtering', () => {
    it('filters out CLI flags', () => {
      expect(parseLocation(['San', 'Ramon', 'CA', '--celsius'])).toBe('San Ramon CA');
    });

    it('filters out unit keywords', () => {
      expect(parseLocation(['-u', 'metric', 'London'])).toBe('London');
      expect(parseLocation(['Paris', '--fahrenheit', '-f'])).toBe('Paris');
    });
  });

  describe('comma handling', () => {
    it('normalizes spacing around commas', () => {
      expect(parseLocation(['City,', 'State'])).toBe('City, State');
    });

    it('preserves existing comma-separated format', () => {
      expect(parseLocation(['San Ramon, CA, US'])).toBe('San Ramon, CA, US');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty input', () => {
      expect(parseLocation([])).toBeNull();
      expect(parseLocation(null)).toBeNull();
    });

    it('returns null when only options are provided', () => {
      expect(parseLocation(['--celsius', '-f'])).toBeNull();
    });
  });
});
