// Braille line-chart renderer.
//
// Each Unicode braille char (U+2800 + bits) packs a 2×4 dot grid, giving the
// chart double the horizontal and quadruple the vertical resolution of the
// surrounding text. We draw a polyline between consecutive data points using
// Bresenham's line algorithm so slopes stay smooth.

// Bit positions per (row, col) inside one braille cell.
//   row 0:  ⠁ ⠈
//   row 1:  ⠂ ⠐
//   row 2:  ⠄ ⠠
//   row 3:  ⡀ ⢀
const BRAILLE_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80]
];

function brailleChar(bits) {
  return String.fromCodePoint(0x2800 + bits);
}

function* bresenhamLine(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  // Cap iterations as a safety belt against pathological inputs.
  const maxSteps = dx - dy + 1;
  for (let step = 0; step <= maxSteps; step++) {
    yield [x, y];
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Render an array of numbers as a multi-row braille line chart.
// width / height are in *character cells* — internally we work at 2×4 the
// resolution to drive individual braille dots.
export function renderBrailleLineChart(values, { width, height }) {
  if (!Array.isArray(values) || values.length < 2 || width < 1 || height < 1) {
    return '';
  }

  const dotW = width * 2;
  const dotH = height * 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // flat line when all values are equal

  const points = values.map((v, i) => {
    const x = Math.round((i / (values.length - 1)) * (dotW - 1));
    // Higher value sits visually higher, which is a smaller y in our top-down grid.
    const y = Math.round((1 - (v - min) / range) * (dotH - 1));
    return [x, y];
  });

  const grid = Array.from({ length: height }, () => new Uint8Array(width));
  const plot = (x, y) => {
    if (x < 0 || x >= dotW || y < 0 || y >= dotH) return;
    grid[Math.floor(y / 4)][Math.floor(x / 2)] |= BRAILLE_BITS[y % 4][x % 2];
  };

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    for (const [x, y] of bresenhamLine(x0, y0, x1, y1)) plot(x, y);
  }

  return grid.map((row) => Array.from(row, brailleChar).join('')).join('\n');
}

// Compute the integer column for each of `n` evenly-spaced points spanning
// a chart of `width` columns. Always pins point 0 to col 0 and point n-1
// to col width-1.
export function dataPointColumns(n, width) {
  if (n <= 0 || width <= 0) return [];
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * (width - 1)));
}

// Lay out `items` at the given target column positions, separating with
// spaces. If two items collide (target column already passed), the next
// item is placed one space after the previous — better minor drift than
// a thrown error.
export function buildLabelRow(items, columns, itemWidths) {
  let out = '';
  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const target = columns[i] ?? cursor;
    if (target > cursor) {
      out += ' '.repeat(target - cursor);
      cursor = target;
    } else if (i > 0) {
      out += ' ';
      cursor += 1;
    }
    out += items[i];
    cursor += itemWidths[i] ?? 1;
  }
  return out;
}
