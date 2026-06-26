import { describe, it, expect } from 'vitest';
import { palettes, PALETTE_KEYS, getPalette } from '../../src/ascii/palette.js';

const newPaletteNames = [
  'catppuccin',
  'gruvbox',
  'tokyo-night',
  'kanagawa',
  'rose-pine',
  'everforest',
  'one-dark',
  'night-owl',
  'cyberpunk',
  'iceberg'
];

describe('palette.js - new palettes', () => {
  describe('palette existence', () => {
    for (const name of newPaletteNames) {
      it(`should include the "${name}" palette`, () => {
        expect(palettes).toHaveProperty(name);
      });
    }
  });

  describe('palette keys', () => {
    for (const name of newPaletteNames) {
      it(`"${name}" palette should have all 16 PALETTE_KEYS`, () => {
        const palette = palettes[name];
        for (const key of PALETTE_KEYS) {
          expect(palette).toHaveProperty(key);
        }
        expect(Object.keys(palette)).toHaveLength(PALETTE_KEYS.length);
      });
    }
  });

  describe('hex color format', () => {
    for (const name of newPaletteNames) {
      it(`all colors in "${name}" should match #RRGGBB hex format`, () => {
        const palette = palettes[name];
        for (const key of PALETTE_KEYS) {
          expect(palette[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });
    }
  });

  describe('getPalette function', () => {
    it('should return the catppuccin palette for "catppuccin"', () => {
      const result = getPalette('catppuccin');
      expect(result).toBe(palettes.catppuccin);
      expect(result).not.toBe(palettes.day);
    });

    it('should fall back to day palette for unknown name', () => {
      const result = getPalette('unknown');
      expect(result).toBe(palettes.day);
    });

    it('should fall back to day palette for undefined', () => {
      const result = getPalette(undefined);
      expect(result).toBe(palettes.day);
    });
  });
});
