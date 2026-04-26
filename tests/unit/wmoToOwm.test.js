import { describe, it, expect } from 'vitest';
import { wmoToOwm, usAqiToOwmAqi } from '../../src/api/wmoToOwm.js';

describe('wmoToOwm', () => {
  it('maps clear sky (0) to OWM 800', () => {
    expect(wmoToOwm(0)).toEqual({ id: 800, main: 'Clear', description: 'clear sky' });
  });

  it('maps partly cloudy (2) to OWM 802', () => {
    expect(wmoToOwm(2).id).toBe(802);
    expect(wmoToOwm(2).main).toBe('Clouds');
  });

  it('maps overcast (3) to OWM 804', () => {
    expect(wmoToOwm(3).id).toBe(804);
  });

  it('maps fog (45, 48) to OWM 741', () => {
    expect(wmoToOwm(45).id).toBe(741);
    expect(wmoToOwm(48).id).toBe(741);
  });

  it('maps moderate rain (63) to OWM 501', () => {
    expect(wmoToOwm(63)).toEqual({ id: 501, main: 'Rain', description: 'moderate rain' });
  });

  it('maps heavy snow fall (75) to OWM 602', () => {
    expect(wmoToOwm(75).id).toBe(602);
    expect(wmoToOwm(75).main).toBe('Snow');
  });

  it('maps thunderstorm (95) to OWM 200', () => {
    expect(wmoToOwm(95).id).toBe(200);
    expect(wmoToOwm(95).main).toBe('Thunderstorm');
  });

  it('maps thunderstorm with hail (96, 99) to OWM 211', () => {
    expect(wmoToOwm(96).id).toBe(211);
    expect(wmoToOwm(99).id).toBe(211);
  });

  it('falls back to Clouds for unknown WMO codes', () => {
    expect(wmoToOwm(999)).toEqual({ id: 804, main: 'Clouds', description: 'unknown' });
    expect(wmoToOwm(undefined).main).toBe('Clouds');
    expect(wmoToOwm(null).main).toBe('Clouds');
  });

  it('produced ids are present in the ascii SCENE_MAP', async () => {
    const { SCENE_MAP } = await import('../../src/ascii/index.js');
    const wmoCodes = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99
    ];
    for (const code of wmoCodes) {
      const owmId = wmoToOwm(code).id;
      expect(SCENE_MAP[owmId]).toBeDefined();
    }
  });
});

describe('usAqiToOwmAqi', () => {
  it('maps Good (0–50) to 1', () => {
    expect(usAqiToOwmAqi(0)).toBe(1);
    expect(usAqiToOwmAqi(50)).toBe(1);
  });

  it('maps Moderate (51–100) to 2', () => {
    expect(usAqiToOwmAqi(51)).toBe(2);
    expect(usAqiToOwmAqi(100)).toBe(2);
  });

  it('maps Unhealthy for Sensitive Groups (101–150) to 3', () => {
    expect(usAqiToOwmAqi(101)).toBe(3);
    expect(usAqiToOwmAqi(150)).toBe(3);
  });

  it('maps Unhealthy (151–200) to 4', () => {
    expect(usAqiToOwmAqi(151)).toBe(4);
    expect(usAqiToOwmAqi(200)).toBe(4);
  });

  it('maps Very Unhealthy/Hazardous (>200) to 5', () => {
    expect(usAqiToOwmAqi(201)).toBe(5);
    expect(usAqiToOwmAqi(500)).toBe(5);
  });

  it('returns null for missing/invalid input', () => {
    expect(usAqiToOwmAqi(null)).toBeNull();
    expect(usAqiToOwmAqi(undefined)).toBeNull();
    expect(usAqiToOwmAqi(NaN)).toBeNull();
  });
});
