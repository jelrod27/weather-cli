import { describe, it, expect } from 'vitest';
import { palettes, PALETTE_KEYS, getPalette } from '../../src/ascii/palette.js';

// Validate every palette defined in the module — including day, night,
// and the original named themes — not just the batch added in a single PR.
const allPaletteNames = Object.keys(palettes);

describe('palette.js - all palettes', () => {
  describe('palette existence', () => {
    it('should define all expected palette names', () => {
      // Must include the built-in day/night plus all named themes
      expect(allPaletteNames).toContain('day');
      expect(allPaletteNames).toContain('night');
      expect(allPaletteNames).toContain('retro');
      expect(allPaletteNames).toContain('dracula');
      expect(allPaletteNames).toContain('solarized');
      expect(allPaletteNames).toContain('nord');
      expect(allPaletteNames).toContain('catppuccin');
      expect(allPaletteNames).toContain('gruvbox');
      expect(allPaletteNames).toContain('tokyo-night');
      expect(allPaletteNames).toContain('kanagawa');
      expect(allPaletteNames).toContain('rose-pine');
      expect(allPaletteNames).toContain('everforest');
      expect(allPaletteNames).toContain('one-dark');
      expect(allPaletteNames).toContain('night-owl');
      expect(allPaletteNames).toContain('cyberpunk');
      expect(allPaletteNames).toContain('iceberg');
    });
  });

  describe('palette keys', () => {
    for (const name of allPaletteNames) {
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
    for (const name of allPaletteNames) {
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

    it('should return the day palette for "day"', () => {
      const result = getPalette('day');
      expect(result).toBe(palettes.day);
    });

    it('should return the night palette for "night"', () => {
      const result = getPalette('night');
      expect(result).toBe(palettes.night);
    });

    it('should fall back to day palette for unknown name', () => {
      const result = getPalette('unknown');
      expect(result).toBe(palettes.day);
    });

    it('should fall back to day palette for undefined', () => {
      const result = getPalette(undefined);
      expect(result).toBe(palettes.day);
    });

    it('should fall back to day palette for null', () => {
      const result = getPalette(null);
      expect(result).toBe(palettes.day);
    });
  });
});
