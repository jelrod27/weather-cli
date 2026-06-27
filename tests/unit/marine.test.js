import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared httpClient so fetchMarine never hits the network.
vi.mock('../../src/api/http.js', () => ({
  default: {
    get: vi.fn()
  }
}));

import httpClient from '../../src/api/http.js';
import { fetchMarine, displayMarine, degToCardinal } from '../../src/api/marine.js';

function marineResponse(overrides = {}) {
  const current = {
    wave_height: 1.8,
    wave_direction: 220,
    wave_period: 6.5,
    sea_surface_temperature: 18.3,
    ocean_current_velocity: 0.42,
    ...overrides
  };
  return {
    data: {
      current,
      timezone: 'America/Los_Angeles',
      utc_offset_seconds: -25200
    }
  };
}

describe('degToCardinal', () => {
  it('returns N for 0 degrees', () => {
    expect(degToCardinal(0)).toBe('N');
  });

  it('returns E for 90 degrees', () => {
    expect(degToCardinal(90)).toBe('E');
  });

  it('returns S for 180 degrees', () => {
    expect(degToCardinal(180)).toBe('S');
  });

  it('returns W for 270 degrees', () => {
    expect(degToCardinal(270)).toBe('W');
  });

  it('returns SW for 220 degrees (rounds to 225)', () => {
    expect(degToCardinal(220)).toBe('SW');
  });

  it('returns NE for 45 degrees', () => {
    expect(degToCardinal(45)).toBe('NE');
  });

  it('wraps negative values into 0-360 range', () => {
    // -90 -> 270 (W), -45 -> 315 (NW)
    expect(degToCardinal(-90)).toBe('W');
    expect(degToCardinal(-45)).toBe('NW');
    expect(degToCardinal(-180)).toBe('S');
  });

  it('returns N/A for null/undefined/NaN', () => {
    expect(degToCardinal(null)).toBe('N/A');
    expect(degToCardinal(undefined)).toBe('N/A');
    expect(degToCardinal(NaN)).toBe('N/A');
  });
});

describe('fetchMarine', () => {
  beforeEach(() => {
    httpClient.get.mockReset();
  });

  it('calls the marine endpoint with the correct params and normalizes the response', async () => {
    httpClient.get.mockResolvedValueOnce(marineResponse());

    const result = await fetchMarine(37.77, -122.42);

    expect(httpClient.get).toHaveBeenCalledTimes(1);
    const [url, config] = httpClient.get.mock.calls[0];
    expect(url).toBe('https://marine-api.open-meteo.com/v1/marine');
    expect(config.params).toMatchObject({
      latitude: 37.77,
      longitude: -122.42,
      timezone: 'auto'
    });
    expect(config.params.current).toContain('wave_height');
    expect(config.params.current).toContain('wave_direction');
    expect(config.params.current).toContain('wave_period');
    expect(config.params.current).toContain('sea_surface_temperature');
    expect(config.params.current).toContain('ocean_current_velocity');
    expect(config.params.hourly).toContain('wave_height');
    expect(config.params.hourly).toContain('wave_direction');
    expect(config.params.hourly).toContain('wave_period');
    expect(config.params.hourly).toContain('sea_surface_temperature');

    expect(result).toEqual({
      waveHeight: 1.8,
      waveDirection: 220,
      waveDirectionCardinal: 'SW',
      wavePeriod: 6.5,
      seaSurfaceTemp: 18.3,
      oceanCurrentVelocity: 0.42,
      timezone: 'America/Los_Angeles',
      utc_offset_seconds: -25200
    });
  });

  it('rounds wave direction to the nearest integer degree', async () => {
    httpClient.get.mockResolvedValueOnce(marineResponse({ wave_direction: 214.6 }));

    const result = await fetchMarine(40.71, -74.0);

    expect(result.waveDirection).toBe(215);
  });

  it('includes the cardinal direction alongside the numeric degrees', async () => {
    httpClient.get.mockResolvedValueOnce(marineResponse({ wave_direction: 90 }));

    const result = await fetchMarine(40.71, -74.0);

    expect(result.waveDirection).toBe(90);
    expect(result.waveDirectionCardinal).toBe('E');
  });

  it('returns null when all current marine fields are absent (inland location)', async () => {
    httpClient.get.mockResolvedValueOnce({
      data: {
        current: {
          wave_height: null,
          wave_direction: null,
          wave_period: null,
          sea_surface_temperature: null,
          ocean_current_velocity: null
        },
        timezone: 'America/Denver',
        utc_offset_seconds: -21600
      }
    });

    const result = await fetchMarine(39.74, -104.99); // Denver (inland)

    expect(result).toBeNull();
  });

  it('returns null when the current block is entirely missing', async () => {
    httpClient.get.mockResolvedValueOnce({
      data: { timezone: 'America/Denver' }
    });

    const result = await fetchMarine(39.74, -104.99);

    expect(result).toBeNull();
  });

  it('returns null when the API response is empty', async () => {
    httpClient.get.mockResolvedValueOnce({ data: null });

    const result = await fetchMarine(39.74, -104.99);

    expect(result).toBeNull();
  });

  it('still returns a result when some fields are null but others are present', async () => {
    httpClient.get.mockResolvedValueOnce(
      marineResponse({
        wave_height: null,
        wave_direction: null,
        wave_period: 5.0,
        sea_surface_temperature: null,
        ocean_current_velocity: null
      })
    );

    const result = await fetchMarine(37.77, -122.42);

    expect(result).not.toBeNull();
    expect(result.waveHeight).toBeNull();
    expect(result.waveDirection).toBeNull();
    expect(result.waveDirectionCardinal).toBe('N/A');
    expect(result.wavePeriod).toBe(5.0);
    expect(result.seaSurfaceTemp).toBeNull();
    expect(result.oceanCurrentVelocity).toBeNull();
  });

  it('propagates the HTTP error when the request fails', async () => {
    const err = new Error('network down');
    err.response = { status: 500 };
    httpClient.get.mockRejectedValueOnce(err);

    await expect(fetchMarine(37.77, -122.42)).rejects.toThrow('network down');
  });
});

describe('displayMarine', () => {
  const place = {
    name: 'San Francisco',
    admin1: 'California',
    country: 'US',
    lat: 37.77,
    lon: -122.42
  };

  it('renders a boxen-framed display containing all marine fields and the location', () => {
    const marine = {
      waveHeight: 1.8,
      waveDirection: 220,
      waveDirectionCardinal: 'SW',
      wavePeriod: 6.5,
      seaSurfaceTemp: 18.3,
      oceanCurrentVelocity: 0.42,
      timezone: 'America/Los_Angeles',
      utc_offset_seconds: -25200
    };

    const out = displayMarine(marine, place);

    expect(out).toContain('Marine Conditions');
    expect(out).toContain('1.8 m');
    expect(out).toContain('220° SW');
    expect(out).toContain('6.5 s');
    expect(out).toContain('18.3 °C');
    expect(out).toContain('0.42 m/s');
    expect(out).toContain('San Francisco, California, US');
  });

  it('shows N/A for fields that are null', () => {
    const marine = {
      waveHeight: null,
      waveDirection: null,
      waveDirectionCardinal: 'N/A',
      wavePeriod: null,
      seaSurfaceTemp: null,
      oceanCurrentVelocity: null,
      timezone: 'America/Denver',
      utc_offset_seconds: -21600
    };

    const out = displayMarine(marine, place);

    // 5 marine field rows + 1 location row → 6 N/A's (5 marine) plus location
    const naCount = (out.match(/N\/A/g) || []).length;
    expect(naCount).toBe(5);
  });

  it('uses the short location label when admin1 is absent', () => {
    const marine = {
      waveHeight: 1.0,
      waveDirection: 0,
      waveDirectionCardinal: 'N',
      wavePeriod: 4.0,
      seaSurfaceTemp: 10.0,
      oceanCurrentVelocity: 0.1,
      timezone: null,
      utc_offset_seconds: null
    };

    const out = displayMarine(marine, {
      name: 'Reykjavik',
      admin1: '',
      country: 'IS',
      lat: 64.15,
      lon: -21.94
    });

    expect(out).toContain('Reykjavik, IS');
    expect(out).not.toContain('Reykjavik, ,');
  });
});
