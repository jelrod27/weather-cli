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
    for (const name of allPaletteNames) {
      it(`should return the "${name}" palette by name`, () => {
        expect(getPalette(name)).toBe(palettes[name]);
      });
    }

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

  describe('luminance contrast', () => {
    // WCAG relative luminance — ensures key elements are distinguishable
    // from the sky background in each palette.
    function relativeLuminance(hex) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const toLin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    }

    function contrastRatio(hex1, hex2) {
      const l1 = relativeLuminance(hex1);
      const l2 = relativeLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Pairs that must be visually distinguishable: sky vs foreground elements
    const contrastPairs = [
      { fg: 'sun', label: 'sky vs sun' },
      { fg: 'cloud', label: 'sky vs cloud' },
      { fg: 'ground', label: 'sky vs ground' },
      { fg: 'houseRoof', label: 'sky vs houseRoof' }
    ];

    // Minimum contrast ratio for element distinguishability.
    // WCAG AA for large text is 3:1 — we use 2.5 as a pragmatic floor for
    // decorative ASCII art where shape also carries information.
    const MIN_CONTRAST = 2.5;

    // Pairs that currently fall below MIN_CONTRAST, listed as "palette:element".
    // Every pair not listed here is held to the hard floor. If one of these
    // palettes is improved, its test fails until the entry is removed, so the
    // list can only shrink.
    const KNOWN_LOW_CONTRAST = new Set([
      'day:sun',
      'day:cloud',
      'night:cloud',
      'night:ground',
      'night:houseRoof',
      'retro:cloud',
      'retro:ground',
      'retro:houseRoof',
      'solarized:sun',
      'solarized:cloud',
      'solarized:ground',
      'solarized:houseRoof',
      'nord:cloud',
      'nord:houseRoof',
      'one-dark:cloud',
      'cyberpunk:cloud'
    ]);

    for (const name of allPaletteNames) {
      for (const { fg, label } of contrastPairs) {
        const ratio = () => contrastRatio(palettes[name].sky, palettes[name][fg]);

        if (KNOWN_LOW_CONTRAST.has(`${name}:${fg}`)) {
          it(`"${name}" ${label} is a known low-contrast pair (< ${MIN_CONTRAST})`, () => {
            expect(
              ratio(),
              `${name} ${label} now meets ${MIN_CONTRAST}; remove "${name}:${fg}" from KNOWN_LOW_CONTRAST`
            ).toBeLessThan(MIN_CONTRAST);
          });
        } else {
          it(`"${name}" ${label} contrast >= ${MIN_CONTRAST}`, () => {
            expect(ratio()).toBeGreaterThanOrEqual(MIN_CONTRAST);
          });
        }
      }
    }
  });
});
