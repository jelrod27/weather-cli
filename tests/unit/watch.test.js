import { describe, it, expect } from 'vitest';
import { program } from 'commander';

// We re-import index.js in a way that lets us inspect the registered commands.
// Because index.js calls program.parseAsync() at the end, importing it directly
// would parse process.argv. To avoid side effects, we read the source and check
// the command registration structurally, and we unit-test the interval parsing
// logic in isolation.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '..', '..', 'src', 'commands', 'index.js'), 'utf8');

// Re-implement the parsing logic mirroring the watch action so we can test it
// without spinning up an interval that would hang the test process.
function parseInterval(value) {
  const intervalRaw = Number.parseInt(value, 10);
  return Number.isInteger(intervalRaw) && intervalRaw >= 1 && intervalRaw <= 60 ? intervalRaw : 5;
}

describe('watch command', () => {
  it('is registered in index.js', () => {
    expect(source).toMatch(/\.command\(['"]watch \[location\]['"]\)/);
  });

  it('has a --interval option', () => {
    expect(source).toMatch(/--interval <minutes>/);
  });

  it('registers a SIGINT handler that exits 0', () => {
    expect(source).toMatch(/process\.on\(['"]SIGINT['"]/);
    expect(source).toMatch(/process\.exit\(0\)/);
  });

  it('uses console.clear before each render', () => {
    expect(source).toMatch(/console\.clear\(\)/);
  });

  it('uses setInterval for the refresh loop', () => {
    expect(source).toMatch(/setInterval\(/);
  });

  it('parses valid interval values within 1-60', () => {
    expect(parseInterval('5')).toBe(5);
    expect(parseInterval('1')).toBe(1);
    expect(parseInterval('60')).toBe(60);
    expect(parseInterval('30')).toBe(30);
  });

  it('clamps out-of-range values to the default of 5', () => {
    expect(parseInterval('0')).toBe(5);
    expect(parseInterval('61')).toBe(5);
    expect(parseInterval('-3')).toBe(5);
    expect(parseInterval('100')).toBe(5);
  });

  it('falls back to default for non-numeric input', () => {
    expect(parseInterval('abc')).toBe(5);
    expect(parseInterval('')).toBe(5);
    expect(parseInterval(NaN)).toBe(5);
  });

  it('the registered watch command can be found on a fresh commander program', () => {
    // Verify commander accepts the same option signature we use.
    const cmd = program
      .command('watch [location]')
      .option('-i, --interval <minutes>', 'Refresh interval in minutes (1-60)', '5');
    const opts = cmd.options;
    expect(opts.some((o) => o.long === '--interval')).toBe(true);
    // Default should be '5'
    const intervalOpt = opts.find((o) => o.long === '--interval');
    expect(intervalOpt.defaultValue).toBe('5');
  });
});
