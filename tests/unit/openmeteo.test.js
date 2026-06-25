import { describe, it, expect } from 'vitest';
import { parseLocationQuery, normalizeToOwmShape } from '../../src/api/openmeteo.js';

describe('parseLocationQuery', () => {
  it('parses a plain city name', () => {
    expect(parseLocationQuery('London')).toEqual({
      name: 'London',
      country: null,
      admin1: null
    });
  });

  it('parses "City, Country"', () => {
    expect(parseLocationQuery('London, UK')).toEqual({
      name: 'London',
      country: 'GB', // UK aliased to GB
      admin1: null
    });
  });

  it('parses "City, State, Country" with admin1 hint', () => {
    expect(parseLocationQuery('San Ramon, CA, US')).toEqual({
      name: 'San Ramon',
      country: 'US',
      admin1: 'CA'
    });
  });

  it('does not treat long trailing tokens as country codes', () => {
    expect(parseLocationQuery('Saint Petersburg, Russia')).toEqual({
      name: 'Saint Petersburg',
      country: null,
      admin1: null
    });
  });

  it('handles trimming and empty parts', () => {
    expect(parseLocationQuery('  Tokyo  ,  JP  ')).toEqual({
      name: 'Tokyo',
      country: 'JP',
      admin1: null
    });
  });

  it('aliases USA to US', () => {
    expect(parseLocationQuery('New York, USA')).toEqual({
      name: 'New York',
      country: 'US',
      admin1: null
    });
  });

  it('aliases UAE to AE', () => {
    expect(parseLocationQuery('Dubai, UAE')).toEqual({
      name: 'Dubai',
      country: 'AE',
      admin1: null
    });
  });

  it('aliases 3-letter informal codes to ISO alpha-2', () => {
    expect(parseLocationQuery('Ottawa, CAN')).toEqual({
      name: 'Ottawa',
      country: 'CA',
      admin1: null
    });
    expect(parseLocationQuery('Sydney, AUS')).toEqual({
      name: 'Sydney',
      country: 'AU',
      admin1: null
    });
    expect(parseLocationQuery('Seoul, KOR')).toEqual({
      name: 'Seoul',
      country: 'KR',
      admin1: null
    });
  });

  it('recognizes US state codes as admin1 hints with country=US', () => {
    expect(parseLocationQuery('San Ramon, CA')).toEqual({
      name: 'San Ramon',
      country: 'US',
      admin1: 'CA'
    });
    expect(parseLocationQuery('New York, NY')).toEqual({
      name: 'New York',
      country: 'US',
      admin1: 'NY'
    });
    expect(parseLocationQuery('Miami, FL')).toEqual({
      name: 'Miami',
      country: 'US',
      admin1: 'FL'
    });
  });

  it('recognizes Canadian province codes as admin1 with country=CA', () => {
    expect(parseLocationQuery('Vancouver, BC')).toEqual({
      name: 'Vancouver',
      country: 'CA',
      admin1: 'BC'
    });
    expect(parseLocationQuery('Toronto, ON')).toEqual({
      name: 'Toronto',
      country: 'CA',
      admin1: 'ON'
    });
  });

  it('does not confuse CA (California) with CA (Canada)', () => {
    // "San Ramon, CA" → US/California, NOT Canada
    const result = parseLocationQuery('San Ramon, CA');
    expect(result.country).toBe('US');
    expect(result.admin1).toBe('CA');
  });

  it('respects explicit country in 3-part input over state-code overlap', () => {
    // "Toronto, ON, CA" → country=CA (Canada), admin1=ON
    // Without the parts.length === 2 guard, CA would match US_STATE_CODES
    // and incorrectly resolve to country=US, admin1=CA
    expect(parseLocationQuery('Toronto, ON, CA')).toEqual({
      name: 'Toronto',
      country: 'CA',
      admin1: 'ON'
    });
  });
});

describe('normalizeToOwmShape', () => {
  // Minimal Open-Meteo-shaped fixture
  const place = {
    name: 'San Ramon',
    lat: 37.78,
    lon: -121.97,
    country: 'US',
    admin1: 'California'
  };

  const forecast = {
    current: {
      time: '2026-04-26T12:00',
      temperature_2m: 72,
      apparent_temperature: 70,
      relative_humidity_2m: 55,
      dew_point_2m: 14,
      pressure_msl: 1015,
      weather_code: 2, // partly cloudy
      is_day: 1,
      wind_speed_10m: 5,
      wind_direction_10m: 270,
      wind_gusts_10m: 9,
      cloud_cover: 40
    },
    hourly: {
      time: [
        '2026-04-26T00:00',
        '2026-04-26T03:00',
        '2026-04-26T06:00',
        '2026-04-26T09:00',
        '2026-04-26T12:00',
        '2026-04-26T15:00',
        '2026-04-26T18:00',
        '2026-04-26T21:00',
        '2026-04-27T00:00',
        '2026-04-27T03:00',
        '2026-04-27T06:00',
        '2026-04-27T09:00',
        '2026-04-27T12:00',
        '2026-04-27T15:00',
        '2026-04-27T18:00',
        '2026-04-27T21:00'
      ],
      temperature_2m: [55, 53, 52, 60, 72, 75, 70, 62, 50, 51, 50, 58, 70, 73, 68, 60],
      weather_code: [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1, 2, 2, 3, 3],
      wind_speed_10m: [3, 3, 3, 4, 5, 6, 5, 4, 3, 3, 3, 4, 5, 6, 5, 4],
      wind_direction_10m: [
        270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270
      ],
      relative_humidity_2m: [70, 72, 75, 65, 55, 50, 55, 60, 70, 72, 75, 65, 55, 50, 55, 60],
      visibility: [
        16000, 16000, 16000, 14000, 12000, 12000, 14000, 16000, 16000, 16000, 16000, 14000, 12000,
        12000, 14000, 16000
      ],
      pressure_msl: [
        1010, 1011, 1012, 1013, 1015, 1016, 1014, 1012, 1011, 1010, 1011, 1012, 1013, 1014, 1013,
        1012
      ]
    },
    daily: {
      time: ['2026-04-26', '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'],
      weather_code: [2, 1, 0, 61, 80],
      temperature_2m_max: [76, 74, 78, 70, 68],
      temperature_2m_min: [52, 51, 53, 55, 54],
      sunrise: [
        '2026-04-26T06:15',
        '2026-04-27T06:14',
        '2026-04-28T06:13',
        '2026-04-29T06:12',
        '2026-04-30T06:11'
      ],
      sunset: [
        '2026-04-26T19:50',
        '2026-04-27T19:51',
        '2026-04-28T19:52',
        '2026-04-29T19:53',
        '2026-04-30T19:54'
      ]
    }
  };

  it('produces an OWM-shaped current block', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: 42, hourly: {}, daily: {} }
    });
    expect(data.current.name).toBe('San Ramon');
    expect(data.current.coord).toEqual({ lat: 37.78, lon: -121.97 });
    expect(data.current.sys.country).toBe('US');
    expect(typeof data.current.sys.sunrise).toBe('number');
    expect(typeof data.current.sys.sunset).toBe('number');
    expect(data.current.main.temp).toBe(72);
    expect(data.current.main.feels_like).toBe(70);
    expect(data.current.main.humidity).toBe(55);
    expect(data.current.main.pressure).toBe(1015);
    expect(data.current.main.temp_min).toBe(52);
    expect(data.current.main.temp_max).toBe(76);
    expect(data.current.weather[0]).toEqual({
      id: 802,
      main: 'Clouds',
      description: 'partly cloudy'
    });
    expect(data.current.wind.speed).toBe(5);
    expect(data.current.wind.gust).toBe(9);
  });

  it('produces a future-only forecast list at 3-hour stride', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: 42, hourly: {}, daily: {} }
    });
    expect(Array.isArray(data.forecast.list)).toBe(true);
    // current.time is 12:00 (curIdx=4); next 3-hour boundary >= 4 is 6.
    // Indices 6, 9, 12, 15 → 4 future entries.
    expect(data.forecast.list.length).toBe(4);
    expect(data.forecast.list[0].dt_txt).toBe('2026-04-26T18:00');
    expect(data.forecast.list[0].main.temp).toBe(70);
    expect(data.forecast.list[0].weather[0].id).toBe(804); // WMO 3 → OWM 804
    expect(data.forecast.list[1].dt_txt).toBe('2026-04-27T03:00');
    expect(data.forecast.list[1].main.temp).toBe(51);
    expect(data.forecast.list[1].weather[0].id).toBe(800); // WMO 0 → OWM 800
  });

  it('normalizes air quality from US AQI to OWM 1–5 scale', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: 42, hourly: {}, daily: {} }
    });
    expect(data.pollution.list[0].main.aqi).toBe(1);

    const noAqi = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(noAqi.pollution.list).toEqual([]);
  });

  it('uses visibility from the hourly entry nearest the current time', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    // Current time is 12:00, which matches index 4 → visibility 12000
    expect(data.current.visibility).toBe(12000);
  });

  it('defaults windUnit to ms when not provided', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.windUnit).toBe('ms');
  });

  it('includes windUnit in the returned shape when provided', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} },
      windUnit: 'mph'
    });
    expect(data.windUnit).toBe('mph');
  });

  it('includes AQI in forecast items when hourly AQI data is available', () => {
    const airQuality = {
      current: 42,
      hourly: {
        time: forecast.hourly.time,
        us_aqi: [30, 35, 40, 45, 42, 50, 55, 38, 28, 32, 44, 48, 52, 60, 42, 36]
      },
      daily: {}
    };
    const data = normalizeToOwmShape({ place, forecast, airQuality });
    // Forecast items starting from index 6 should have aqi
    expect(data.forecast.list.length).toBeGreaterThan(0);
    expect(data.forecast.list[0].aqi).toBe(2); // 55 → OWM scale 2 (Fair)
    expect(data.forecast.list[1].aqi).toBe(1); // 28 → OWM scale 1 (Good)
  });

  it('includes dailyAqi map when daily AQI data is available', () => {
    const airQuality = {
      current: 42,
      hourly: {},
      daily: {
        time: ['2026-04-26', '2026-04-27'],
        us_aqi: [42, 120]
      }
    };
    const data = normalizeToOwmShape({ place, forecast, airQuality });
    const satKey = new Date('2026-04-26T12:00:00').toDateString();
    const sunKey = new Date('2026-04-27T12:00:00').toDateString();
    expect(data.dailyAqi[satKey]).toBe(1); // 42 → Good
    expect(data.dailyAqi[sunKey]).toBe(3); // 120 → Moderate (101-150)
  });

  it('handles missing AQI data gracefully', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.pollution.list).toEqual([]);
    expect(data.dailyAqi).toEqual({});
    expect(data.forecast.list[0].aqi).toBeNull();
  });

  it('includes minutely data when present in the forecast', () => {
    const forecastWithMinutely = {
      ...forecast,
      minutely_15: {
        time: ['2026-04-26T12:00', '2026-04-26T12:15', '2026-04-26T12:30', '2026-04-26T12:45'],
        precipitation: [0, 0.5, 1.2, 0.3]
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: forecastWithMinutely,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.minutely).toBeDefined();
    expect(data.minutely.precipitation).toEqual([0, 0.5, 1.2, 0.3]);
    expect(data.minutely.time).toHaveLength(4);
  });

  it('includes empty minutely object when forecast has no minutely_15 data', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.minutely).toEqual({});
  });

  describe('feels_like edge cases', () => {
    it('handles null apparent_temperature', () => {
      const data = normalizeToOwmShape({
        place,
        forecast: {
          ...forecast,
          current: {
            ...forecast.current,
            apparent_temperature: null
          }
        },
        airQuality: { current: null, hourly: {}, daily: {} }
      });
      expect(data.current.main.feels_like).toBeNull();
    });

    it('handles missing apparent_temperature', () => {
      const currentWithoutApparent = { ...forecast.current };
      delete currentWithoutApparent.apparent_temperature;
      const data = normalizeToOwmShape({
        place,
        forecast: {
          ...forecast,
          current: currentWithoutApparent
        },
        airQuality: { current: null, hourly: {}, daily: {} }
      });
      expect(data.current.main.feels_like).toBeUndefined();
    });
  });

  it('maps uv_index from current weather data', () => {
    const forecastWithUv = {
      ...forecast,
      current: {
        ...forecast.current,
        uv_index: 7.4
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: forecastWithUv,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.uv_index).toBe(7.4);
  });

  it('sets uv_index to undefined when not present in current weather', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.uv_index).toBeUndefined();
  });

  it('maps dew_point from current weather data', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.dew_point).toBe(14);
  });

  it('sets dew_point to undefined when not present in current weather', () => {
    const forecastNoDew = {
      ...forecast,
      current: {
        ...forecast.current,
        dew_point_2m: undefined
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: forecastNoDew,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.dew_point).toBeUndefined();
  });

  it('maps cloud_cover from current weather data', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.cloud_cover).toBe(40);
  });

  it('sets cloud_cover to undefined when not present in current weather', () => {
    const forecastNoCloud = {
      ...forecast,
      current: {
        ...forecast.current,
        cloud_cover: undefined
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: forecastNoCloud,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.cloud_cover).toBeUndefined();
  });

  it('maps precip_probability from daily forecast data', () => {
    const forecastWithPrecip = {
      ...forecast,
      daily: {
        ...forecast.daily,
        precipitation_probability: [30, 10, 5, 0, 20, 40]
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: forecastWithPrecip,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.precip_probability).toBe(30);
  });

  it('sets precip_probability to undefined when not present in daily data', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.precip_probability).toBeUndefined();
  });

  it('computes pressure_trend as rising when pressure increased over 3 hours', () => {
    const data = normalizeToOwmShape({
      place,
      forecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    // curIdx = 4 (12:00), curIdx-3 = 1 (03:00), pressure 1011 -> 1015 = +4.0
    expect(data.current.pressure_trend).toEqual({
      trend: 'rising',
      delta: 4.0,
      pressure_3h_ago: 1011
    });
  });

  it('computes pressure_trend as falling when pressure decreased over 3 hours', () => {
    const fallingForecast = {
      ...forecast,
      current: {
        ...forecast.current,
        pressure_msl: 1005
      },
      hourly: {
        ...forecast.hourly,
        pressure_msl: [
          1013, 1012, 1011, 1010, 1009, 1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001, 1000, 999,
          998
        ]
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: fallingForecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    // curIdx = 4 (12:00), curIdx-3 = 1 (03:00), pressure 1012 -> 1005 = -7.0
    expect(data.current.pressure_trend.trend).toBe('falling');
    expect(data.current.pressure_trend.delta).toBe(-7.0);
  });

  it('computes pressure_trend as steady when pressure change is small', () => {
    const steadyForecast = {
      ...forecast,
      current: {
        ...forecast.current,
        pressure_msl: 1015
      },
      hourly: {
        ...forecast.hourly,
        pressure_msl: [
          1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015, 1015,
          1015
        ]
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: steadyForecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.pressure_trend.trend).toBe('steady');
    expect(data.current.pressure_trend.delta).toBe(0.0);
  });

  it('sets pressure_trend to null when hourly pressure data is missing', () => {
    const noPressureForecast = {
      ...forecast,
      hourly: {
        ...forecast.hourly,
        pressure_msl: undefined
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: noPressureForecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.pressure_trend).toBeNull();
  });

  it('sets pressure_trend to null when curIdx is less than 3', () => {
    const earlyTimeForecast = {
      ...forecast,
      current: {
        ...forecast.current,
        time: '2026-04-26T00:00'
      }
    };
    const data = normalizeToOwmShape({
      place,
      forecast: earlyTimeForecast,
      airQuality: { current: null, hourly: {}, daily: {} }
    });
    expect(data.current.pressure_trend).toBeNull();
  });
});
