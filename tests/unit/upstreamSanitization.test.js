import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();

vi.mock('../../src/api/http.js', () => ({
  default: { get }
}));

const { geocode } = await import('../../src/api/geocode.js');
const { fetchAlerts } = await import('../../src/api/alerts.js');

// Upstream providers are not trusted to return display-safe text. Escape
// sequences that reach the terminal can repaint the screen, rewrite the window
// title, or hide text — and place names also land in shell prompts via
// `weather status`.
describe('geocode strips terminal control sequences from provider strings', () => {
  beforeEach(() => get.mockReset());

  it('sanitizes name, country code and admin1', async () => {
    get.mockResolvedValue({
      data: {
        results: [
          {
            name: '\x1b[31mLondon\x1b[0m\x1b]0;pwned\x07',
            latitude: 51.5,
            longitude: -0.12,
            country_code: 'G\x1b[2JB',
            admin1: 'England\x00'
          }
        ]
      }
    });

    const place = await geocode('London');

    expect(place).toMatchObject({
      name: 'London',
      country: 'GB',
      admin1: 'England',
      lat: 51.5,
      lon: -0.12
    });
  });

  it.each([undefined, null, '', '   ', '\x1b_hidden payload\x1b\\'])(
    'uses the sanitized original location when the provider name is %j',
    async (name) => {
      get.mockResolvedValue({
        data: { results: [{ name, latitude: 51.5, longitude: -0.12 }] }
      });

      const place = await geocode('\x1b[31mLondon\x1b[0m');

      expect(place.name).toBe('London');
    }
  );

  it('uses coordinates when both the provider name and input have no display-safe text', async () => {
    get.mockResolvedValue({
      data: { results: [{ name: null, latitude: 51.5, longitude: -0.12 }] }
    });

    const place = await geocode('\x1b[31m\x1b[0m');

    expect(place.name).toBe('51.5, -0.12');
  });
});

describe('fetchAlerts strips terminal control sequences from NWS text', () => {
  beforeEach(() => get.mockReset());

  it('sanitizes every displayed alert field', async () => {
    get.mockResolvedValue({
      data: {
        features: [
          {
            properties: {
              event: '\x1b[31mTornado Warning',
              headline: '\x1b]0;pwned\x07Take shelter now',
              severity: 'Extreme\x1b[0m',
              urgency: 'Immediate\x07',
              description: 'A tornado\x1b[2J was spotted\nnear town.',
              areaDesc: 'Dallas County\x1b[1A',
              effective: '2026-01-01T00:00:00Z',
              expires: '2026-01-01T01:00:00Z'
            }
          }
        ]
      }
    });

    const [alert] = await fetchAlerts(32.78, -96.8, 'US');

    expect(alert).toMatchObject({
      event: 'Tornado Warning',
      headline: 'Take shelter now',
      severity: 'Extreme',
      urgency: 'Immediate',
      description: 'A tornado was spotted near town.',
      areaDesc: 'Dallas County'
    });
  });

  it('keeps the description snippet at the documented 200-char limit', async () => {
    get.mockResolvedValue({
      data: {
        features: [
          {
            properties: {
              event: 'Flood Watch',
              description: 'x'.repeat(500)
            }
          }
        ]
      }
    });

    const [alert] = await fetchAlerts(32.78, -96.8, 'US');
    expect(alert.description).toHaveLength(200);
    expect(alert.description.endsWith('...')).toBe(true);
  });

  it.each([200, 201])(
    'keeps astral characters intact in a %i-character description',
    async (length) => {
      get.mockResolvedValue({
        data: {
          features: [{ properties: { event: 'Flood Watch', description: '𠮷'.repeat(length) } }]
        }
      });

      const [alert] = await fetchAlerts(32.78, -96.8, 'US');

      expect(alert.description).toBe(length === 200 ? '𠮷'.repeat(200) : '𠮷'.repeat(197) + '...');
      expect(Array.from(alert.description)).toHaveLength(200);
    }
  );
});
