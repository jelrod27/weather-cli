import { describe, it, expect } from 'vitest';
import {
  renderBrailleLineChart,
  dataPointColumns,
  buildLabelRow
} from '../../src/ascii/sparkline.js';

const BRAILLE_BLANK = String.fromCodePoint(0x2800);

describe('renderBrailleLineChart', () => {
  it('returns empty string for too-few values', () => {
    expect(renderBrailleLineChart([], { width: 10, height: 2 })).toBe('');
    expect(renderBrailleLineChart([5], { width: 10, height: 2 })).toBe('');
  });

  it('returns the requested grid dimensions', () => {
    const out = renderBrailleLineChart([1, 5, 3, 8, 2], { width: 16, height: 3 });
    const lines = out.split('\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect([...line]).toHaveLength(16);
    }
  });

  it('renders only braille code points (U+2800..U+28FF)', () => {
    const out = renderBrailleLineChart([10, 20, 5, 15], { width: 12, height: 3 });
    for (const ch of out.replace(/\n/g, '')) {
      const cp = ch.codePointAt(0);
      expect(cp).toBeGreaterThanOrEqual(0x2800);
      expect(cp).toBeLessThanOrEqual(0x28ff);
    }
  });

  it('puts ink in the top row when the first value is the max', () => {
    const out = renderBrailleLineChart([100, 50, 0], { width: 12, height: 4 });
    const [topRow] = out.split('\n');
    // First cell of the top row should have at least one set bit (not blank).
    expect(topRow[0]).not.toBe(BRAILLE_BLANK);
  });

  it('puts ink in the bottom row when the last value is the min', () => {
    const out = renderBrailleLineChart([100, 50, 0], { width: 12, height: 4 });
    const rows = out.split('\n');
    const lastRow = rows[rows.length - 1];
    // Final cell of the last row should have at least one set bit.
    expect(lastRow[lastRow.length - 1]).not.toBe(BRAILLE_BLANK);
  });

  it('handles a flat series without throwing', () => {
    const out = renderBrailleLineChart([7, 7, 7, 7], { width: 8, height: 2 });
    expect(out.split('\n')).toHaveLength(2);
  });
});

describe('dataPointColumns', () => {
  it('pins endpoints to col 0 and col width-1', () => {
    const cols = dataPointColumns(5, 20);
    expect(cols[0]).toBe(0);
    expect(cols[cols.length - 1]).toBe(19);
  });

  it('returns evenly-spaced columns', () => {
    const cols = dataPointColumns(5, 17);
    expect(cols).toEqual([0, 4, 8, 12, 16]);
  });

  it('handles single-point input', () => {
    expect(dataPointColumns(1, 10)).toEqual([0]);
  });

  it('handles zero/negative input', () => {
    expect(dataPointColumns(0, 10)).toEqual([]);
    expect(dataPointColumns(5, 0)).toEqual([]);
  });
});

describe('buildLabelRow', () => {
  it('pads to target columns with spaces', () => {
    const row = buildLabelRow(['A', 'B', 'C'], [0, 5, 10], [1, 1, 1]);
    expect(row).toBe('A    B    C');
  });

  it('falls back to a one-space separator when columns collide', () => {
    // Columns are [0, 1, 5] but item widths exceed available space.
    // The implementation must not crash and must keep all items visible.
    const row = buildLabelRow(['HELLO', 'WORLD', 'X'], [0, 1, 5], [5, 5, 1]);
    expect(row).toContain('HELLO');
    expect(row).toContain('WORLD');
    expect(row).toContain('X');
  });

  it('respects item widths when advancing the cursor', () => {
    // Two two-cell-wide emojis with their target columns set 4 cells apart
    // should render as: "EE  EE" (positions 0 and 4).
    const row = buildLabelRow(['EE', 'EE'], [0, 4], [2, 2]);
    expect(row).toBe('EE  EE');
  });
});
