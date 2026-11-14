import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/http.js', () => ({ default: { get: vi.fn() } }));

import httpClient from '../../src/api/http.js';
import { geocode, parseLocationQuery } from '../../src/api/geocode.js';

describe('unquoted location suffix parsing', () => {
  it.each([
    ['San Ramon CA', { name: 'San Ramon', country: 'US', admin1: 'CA' }],
    ['san ramon ca', { name: 'san ramon', country: 'US', admin1: 'CA' }],
    ['San Ramon US', { name: 'San Ramon', country: 'US', admin1: null }],
    ['San Ramon USA', { name: 'San Ramon', country: 'US', admin1: null }],
    ['Salt Lake City UT', { name: 'Salt Lake City', country: 'US', admin1: 'UT' }],
    ['London UK', { name: 'London', country: 'GB', admin1: null }],
    ['london uk', { name: 'london', country: 'GB', admin1: null }],
    ['Tokyo JP', { name: 'Tokyo', country: 'JP', admin1: null }],
    ['Vancouver BC', { name: 'Vancouver', country: 'CA', admin1: 'BC' }],
    ['vancouver bc', { name: 'vancouver', country: 'CA', admin1: 'BC' }],
    ['San Ramon CA US', { name: 'San Ramon', country: 'US', admin1: 'CA' }],
    ['san ramon ca usa', { name: 'san ramon', country: 'US', admin1: 'CA' }],
    ['Toronto ON CA', { name: 'Toronto', country: 'CA', admin1: 'ON' }],
    ['Vancouver BC CAN', { name: 'Vancouver', country: 'CA', admin1: 'BC' }],
    ['  Salt   Lake City   UT  ', { name: 'Salt Lake City', country: 'US', admin1: 'UT' }]
  ])('parses %s into city and geographic hints', (input, expected) => {
    expect(parseLocationQuery(input)).toEqual(expected);
  });

  it.each(['San Ramon', 'New York', 'Salt Lake City', 'Ho Chi Minh', 'Da Lat', 'Foo ZZ', 'US'])(
    'keeps city-only input %s intact',
    (input) => {
      expect(parseLocationQuery(input)).toEqual({ name: input, country: null, admin1: null });
    }
  );

  it.each([
    ['San Ramon, CA', { name: 'San Ramon', country: 'US', admin1: 'CA' }],
    ['San Ramon, CA, US', { name: 'San Ramon', country: 'US', admin1: 'CA' }],
    ['Toronto, ON, CA', { name: 'Toronto', country: 'CA', admin1: 'ON' }],
    ['London, UK', { name: 'London', country: 'GB', admin1: null }],
    ['Saint Petersburg, Russia', { name: 'Saint Petersburg', country: null, admin1: null }]
  ])('preserves comma-separated parsing for %s', (input, expected) => {
    expect(parseLocationQuery(input)).toEqual(expected);
  });
});

const mexico = {
  name: 'San Ramón Capulac',
  latitude: 19.2673,
  longitude: -98.3885,
  country_code: 'MX',
  admin1: 'Puebla'
};
const california = {
  name: 'San Ramon',
  latitude: 37.7799,
  longitude: -121.978,
  country_code: 'US',
  admin1: 'California'
};

describe('geocode geographic suffix selection', () => {
  afterEach(() => vi.clearAllMocks());

  it.each([
    ['San Ramon CA', 'San Ramon'],
    ['san ramon ca', 'san ramon'],
    ['San Ramon US', 'San Ramon'],
    ['San Ramon USA', 'San Ramon'],
    ['San Ramon CA US', 'San Ramon'],
    ['San Ramon, CA', 'San Ramon']
  ])('queries just the city and selects the US result for %s', async (input, name) => {
    httpClient.get.mockResolvedValue({ data: { results: [mexico, california] } });

    const place = await geocode(input);

    expect(httpClient.get).toHaveBeenCalledWith('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name, count: 10, language: 'en', format: 'json' }
    });
    expect(place).toEqual({
      name: 'San Ramon',
      lat: 37.7799,
      lon: -121.978,
      country: 'US',
      admin1: 'California'
    });
  });

  it('uses the state hint to prefer California over another US result', async () => {
    const texas = { ...california, latitude: 30, longitude: -100, admin1: 'Texas' };
    httpClient.get.mockResolvedValue({ data: { results: [mexico, texas, california] } });

    await expect(geocode('San Ramon CA US')).resolves.toMatchObject({
      country: 'US',
      admin1: 'California',
      lat: 37.7799
    });
  });

  it('reports a missing requested country instead of selecting a fuzzy foreign match', async () => {
    httpClient.get.mockResolvedValue({ data: { results: [mexico] } });

    await expect(geocode('san ramon ca')).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('matches ME to Maine when the provider has no state-code field', async () => {
    httpClient.get.mockResolvedValue({
      data: {
        results: [
          {
            name: 'Portland',
            latitude: 45.5152,
            longitude: -122.6784,
            country_code: 'US',
            admin1: 'Oregon'
          },
          {
            name: 'Portland',
            latitude: 43.6591,
            longitude: -70.2568,
            country_code: 'US',
            admin1: 'Maine'
          }
        ]
      }
    });

    await expect(geocode('Portland ME')).resolves.toMatchObject({
      country: 'US',
      admin1: 'Maine',
      lat: 43.6591
    });
  });

  it('matches BC to British Columbia among multiple Canadian provinces', async () => {
    httpClient.get.mockResolvedValue({
      data: {
        results: [
          {
            name: 'Victoria',
            latitude: 46.17,
            longitude: -63.48,
            country_code: 'CA',
            admin1: 'Prince Edward Island'
          },
          {
            name: 'Victoria',
            latitude: 48.43,
            longitude: -123.37,
            country_code: 'CA',
            admin1: 'British Columbia'
          }
        ]
      }
    });

    await expect(geocode('Victoria BC')).resolves.toMatchObject({
      country: 'CA',
      admin1: 'British Columbia',
      lat: 48.43
    });
  });

  it('matches province names without accents', async () => {
    httpClient.get.mockResolvedValue({
      data: {
        results: [
          {
            name: 'Richmond',
            latitude: 49.16,
            longitude: -123.14,
            country_code: 'CA',
            admin1: 'British Columbia'
          },
          {
            name: 'Richmond',
            latitude: 45.67,
            longitude: -72.15,
            country_code: 'CA',
            admin1: 'Québec'
          }
        ]
      }
    });

    await expect(geocode('Richmond QC')).resolves.toMatchObject({ admin1: 'Québec', lat: 45.67 });
  });

  it.each(['Portland ME', 'Portland, ME, US', 'Portland, Maine, US'])(
    'rejects %s when no result matches the requested state',
    async (input) => {
      httpClient.get.mockResolvedValue({
        data: {
          results: [
            {
              name: 'Portland',
              latitude: 45.5152,
              longitude: -122.6784,
              country_code: 'US',
              admin1: 'Oregon'
            }
          ]
        }
      });

      await expect(geocode(input)).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
    }
  );

  it('preserves explicit full-state-name comma input', async () => {
    httpClient.get.mockResolvedValue({
      data: {
        results: [
          {
            name: 'Portland',
            latitude: 45.5152,
            longitude: -122.6784,
            country_code: 'US',
            admin1: 'Oregon'
          },
          {
            name: 'Portland',
            latitude: 43.6591,
            longitude: -70.2568,
            country_code: 'US',
            admin1: 'Maine'
          }
        ]
      }
    });

    await expect(geocode('Portland, Maine, US')).resolves.toMatchObject({ admin1: 'Maine' });
  });
});

describe('geocode ambiguous city names', () => {
  beforeEach(() => httpClient.get.mockReset());

  it.each([
    {
      input: 'Sa Pa',
      name: 'Sa Pá',
      country: 'VN',
      admin1: 'Lào Cai',
      lat: 22.34,
      inferred: { name: 'Sa', country_code: 'US', admin1: 'Pennsylvania' }
    },
    {
      input: 'mae on',
      name: 'Mae On',
      country: 'TH',
      admin1: 'Chiang Mai',
      lat: 18.73,
      inferred: { name: 'Mae', country_code: 'CA', admin1: 'Ontario' }
    },
    {
      input: 'Yen My',
      name: 'Yên Mỹ',
      country: 'VN',
      admin1: 'Hưng Yên',
      lat: 20.92,
      inferred: { name: 'Yen', country_code: 'MY', admin1: 'Sabah' }
    }
  ])(
    'preserves the full city name $input before interpreting a suffix',
    async ({ input, name, country, admin1, lat, inferred }) => {
      httpClient.get.mockResolvedValue({
        data: {
          results: [
            { ...inferred, latitude: 0, longitude: 0 },
            { name, country_code: country, admin1, latitude: lat, longitude: 103 }
          ]
        }
      });

      await expect(geocode(input)).resolves.toMatchObject({ name, country, admin1, lat });

      expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(
        'https://geocoding-api.open-meteo.com/v1/search',
        { params: { name: input, count: 10, language: 'en', format: 'json' } }
      );
    }
  );

  it('falls back from a fuzzy full-input match to canonical San Ramon in the US', async () => {
    httpClient.get
      .mockResolvedValueOnce({ data: { results: [mexico] } })
      .mockResolvedValueOnce({ data: { results: [mexico, california] } });

    await expect(geocode('san ramon ca')).resolves.toMatchObject({
      country: 'US',
      admin1: 'California'
    });

    expect(httpClient.get.mock.calls.map(([, request]) => request.params.name)).toEqual([
      'san ramon ca',
      'san ramon'
    ]);
  });

  it.each([{ data: { results: [] } }, { data: { generationtime_ms: 0.2 } }])(
    'tries the canonical query when the optional full-input lookup has no results: %j',
    async (response) => {
      httpClient.get
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce({ data: { results: [california] } });

      await expect(geocode('San Ramon CA')).resolves.toMatchObject({
        country: 'US',
        admin1: 'California'
      });
      expect(httpClient.get.mock.calls.map(([, request]) => request.params.name)).toEqual([
        'San Ramon CA',
        'San Ramon'
      ]);
    }
  );

  it.each([null, {}, 'malformed'])(
    'rejects malformed results in the optional lookup: %j',
    async (results) => {
      httpClient.get.mockResolvedValue({ data: { results } });

      await expect(geocode('San Ramon CA')).rejects.toMatchObject({ code: 'UPSTREAM_DATA_ERROR' });
      expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(
        'https://geocoding-api.open-meteo.com/v1/search',
        { params: { name: 'San Ramon CA', count: 10, language: 'en', format: 'json' } }
      );
    }
  );

  it('validates the canonical results after an empty optional lookup', async () => {
    httpClient.get
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: {} } });

    await expect(geocode('San Ramon CA')).rejects.toMatchObject({ code: 'UPSTREAM_DATA_ERROR' });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });

  it('reports no location when neither lookup has results', async () => {
    httpClient.get.mockResolvedValue({ data: { results: [] } });

    await expect(geocode('San Ramon CA')).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });

  it('keeps explicit comma hints unambiguous with one canonical query', async () => {
    httpClient.get.mockResolvedValue({ data: { results: [california] } });

    await expect(geocode('San Ramon, CA')).resolves.toMatchObject({
      country: 'US',
      admin1: 'California'
    });
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(
      'https://geocoding-api.open-meteo.com/v1/search',
      { params: { name: 'San Ramon', count: 10, language: 'en', format: 'json' } }
    );
  });
});
