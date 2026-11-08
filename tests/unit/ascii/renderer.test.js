import { describe, it, expect, vi, afterEach } from 'vitest';
import chalk from 'chalk';
import { AsciiRenderer, MIN_TERM_WIDTH } from '../../../src/ascii/renderer.js';
import { palettes } from '../../../src/ascii/palette.js';

// Force chalk to output ANSI codes in test environment
chalk.level = 3;

const mockScene = {
  name: 'test',
  width: 20,
  height: 3,
  defaultColor: 'sky',
  charColors: {
    '*': 'sun',
    '~': 'ground'
  },
  getArt() {
    return ['    *  *  *         ', '                    ', '~~~~~~~~~~~~~~~~~~~~'];
  }
};

describe('AsciiRenderer', () => {
  const originalEnv = process.env.NO_COLOR;

  afterEach(() => {
    chalk.level = 3;
    if (originalEnv === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalEnv;
    }
  });

  describe('constructor', () => {
    it('uses provided termWidth', () => {
      const renderer = new AsciiRenderer({ termWidth: 100 });
      expect(renderer.termWidth).toBe(100);
    });

    it('defaults useColor to true when NO_COLOR is not set', () => {
      delete process.env.NO_COLOR;
      const renderer = new AsciiRenderer({ termWidth: 80 });
      expect(renderer.useColor).toBe(true);
    });

    it('sets useColor to false when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';
      const renderer = new AsciiRenderer({ termWidth: 80 });
      expect(renderer.useColor).toBe(false);
    });

    it('respects explicit useColor override', () => {
      process.env.NO_COLOR = '1';
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: true });
      expect(renderer.useColor).toBe(true);
    });
  });

  describe('renderToString', () => {
    it('returns empty string when terminal is too narrow', () => {
      const renderer = new AsciiRenderer({ termWidth: MIN_TERM_WIDTH - 1, useColor: false });
      const result = renderer.renderToString(mockScene);
      expect(result).toBe('');
    });

    it('renders at minimum terminal width', () => {
      const renderer = new AsciiRenderer({ termWidth: MIN_TERM_WIDTH, useColor: false });
      const result = renderer.renderToString(mockScene);
      expect(result).not.toBe('');
    });

    it('returns plain text when useColor is false', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: false });
      const result = renderer.renderToString(mockScene);
      // Should not contain ANSI escape codes
      expect(result).not.toMatch(/\x1b\[/);
    });

    it('returns colored text when useColor is true', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: true });
      const result = renderer.renderToString(mockScene);
      // Should contain ANSI escape codes
      expect(result).toMatch(/\x1b\[/);
    });

    it('outputs correct number of lines', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: false });
      const result = renderer.renderToString(mockScene);
      const lines = result.split('\n');
      expect(lines).toHaveLength(mockScene.height);
    });

    it('centers art in the terminal', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: false });
      const result = renderer.renderToString(mockScene);
      const lines = result.split('\n');
      const expectedPad = Math.floor((80 - mockScene.width) / 2);
      const art = mockScene.getArt();
      // Exact match: catches over-padding as well as under-padding.
      lines.forEach((line, i) => {
        expect(line).toBe(' '.repeat(expectedPad) + art[i]);
      });
    });

    it('does not add negative padding for wide art', () => {
      const wideScene = { ...mockScene, width: 100, getArt: () => ['x'.repeat(100)] };
      const renderer = new AsciiRenderer({ termWidth: 60, useColor: false });
      const result = renderer.renderToString(wideScene);
      // Should not crash, no leading spaces
      expect(result).toBe('x'.repeat(100));
    });
  });

  describe('render', () => {
    it('calls console.log with rendered output', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: false });
      renderer.render(mockScene);
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });

    it('does not call console.log when output is empty', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const renderer = new AsciiRenderer({ termWidth: MIN_TERM_WIDTH - 1, useColor: false });
      renderer.render(mockScene);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('colorLine', () => {
    it('returns empty string for empty input', () => {
      const renderer = new AsciiRenderer({ termWidth: 80 });
      const result = renderer.colorLine('', {}, palettes.day, 'sky');
      expect(result).toBe('');
    });

    it('preserves spaces without coloring', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: false });
      const result = renderer.colorLine('   ', {}, palettes.day, 'sky');
      expect(result).toBe('   ');
    });

    it('applies charColors mapping for known characters', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: true });
      const charColors = { '*': 'sun' };
      const result = renderer.colorLine('*', charColors, palettes.day, 'sky');
      // Should contain the sun color (#FFD700) as ANSI
      expect(result).toContain('*');
      expect(result).toMatch(/\x1b\[/);
    });

    it('applies defaultColor for unmapped characters', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: true });
      const result = renderer.colorLine('x', {}, palettes.day, 'sky');
      expect(result).toContain('x');
      expect(result).toMatch(/\x1b\[/);
    });

    it('handles characters not in palette gracefully', () => {
      const renderer = new AsciiRenderer({ termWidth: 80, useColor: true });
      const charColors = { '*': 'nonexistent' };
      const result = renderer.colorLine('*', charColors, palettes.day, 'sky');
      // Should not crash, character should still appear
      expect(result).toContain('*');
    });
  });
});
