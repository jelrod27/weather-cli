import { describe, it, expect } from 'vitest';
import { PALETTE_KEYS } from '../../../src/ascii/palette.js';
import sunny from '../../../src/ascii/scenes/sunny.js';
import cloudy from '../../../src/ascii/scenes/cloudy.js';
import rain from '../../../src/ascii/scenes/rain.js';
import snow from '../../../src/ascii/scenes/snow.js';
import thunder from '../../../src/ascii/scenes/thunder.js';
import fog from '../../../src/ascii/scenes/fog.js';
import nightClear from '../../../src/ascii/scenes/night-clear.js';

const scenes = [
  { module: sunny, label: 'sunny' },
  { module: cloudy, label: 'cloudy' },
  { module: rain, label: 'rain' },
  { module: snow, label: 'snow' },
  { module: thunder, label: 'thunder' },
  { module: fog, label: 'fog' },
  { module: nightClear, label: 'night-clear' }
];

for (const { module: scene, label } of scenes) {
  describe(`${label} scene`, () => {
    it('has a non-empty name', () => {
      expect(scene.name).toBeTruthy();
      expect(typeof scene.name).toBe('string');
    });

    it('has numeric width and height', () => {
      expect(typeof scene.width).toBe('number');
      expect(typeof scene.height).toBe('number');
      expect(scene.width).toBeGreaterThan(0);
      expect(scene.height).toBeGreaterThan(0);
    });

    it('has a valid defaultColor that is a palette key', () => {
      expect(typeof scene.defaultColor).toBe('string');
      expect(PALETTE_KEYS).toContain(scene.defaultColor);
    });

    it('has charColors with values that are valid palette keys', () => {
      expect(typeof scene.charColors).toBe('object');
      for (const [ch, paletteKey] of Object.entries(scene.charColors)) {
        expect(
          PALETTE_KEYS,
          `charColors['${ch}'] = '${paletteKey}' is not a valid palette key`
        ).toContain(paletteKey);
      }
    });

    it('getArt returns an array with length equal to height', () => {
      const art = scene.getArt({ isDay: true });
      expect(Array.isArray(art)).toBe(true);
      expect(art).toHaveLength(scene.height);
    });

    it('every line is within declared width', () => {
      const art = scene.getArt({ isDay: true });
      for (let i = 0; i < art.length; i++) {
        expect(
          art[i].length,
          `line ${i} is ${art[i].length} chars, exceeds width ${scene.width}`
        ).toBeLessThanOrEqual(scene.width);
      }
    });

    it('no line is empty', () => {
      const art = scene.getArt({ isDay: true });
      for (let i = 0; i < art.length; i++) {
        expect(art[i].trim().length, `line ${i} is empty`).toBeGreaterThan(0);
      }
    });

    it('getArt returns consistent output across calls', () => {
      const art1 = scene.getArt({ isDay: true });
      const art2 = scene.getArt({ isDay: true });
      expect(art1).toEqual(art2);
    });

    it('matches snapshot', () => {
      const art = scene.getArt({ isDay: true });
      expect(art.join('\n')).toMatchSnapshot();
    });
  });
}

// Verify that animated scenes actually have differing frames.
// A scene with frameCount > 1 but identical frames is a no-op animation.
describe('animation frame differences', () => {
  const animatedScenes = [
    { module: sunny, label: 'sunny' },
    { module: cloudy, label: 'cloudy' },
    { module: rain, label: 'rain' },
    { module: snow, label: 'snow' },
    { module: thunder, label: 'thunder' },
    { module: fog, label: 'fog' },
    { module: nightClear, label: 'night-clear' }
  ];

  for (const { module: scene, label } of animatedScenes) {
    if (!scene.frameCount || scene.frameCount < 2) continue;

    it(`${label}: at least one frame differs from frame 0`, () => {
      const frames = scene.getFrames();
      const frame0Json = JSON.stringify(frames[0]);
      const anyDifferent = frames.slice(1).some((f) => JSON.stringify(f) !== frame0Json);
      expect(
        anyDifferent,
        `${label} has ${scene.frameCount} frames but they are all identical`
      ).toBe(true);
    });
  }
});
