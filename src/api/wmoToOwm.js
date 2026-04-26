// Map WMO weather codes (Open-Meteo) to OWM-shape weather objects.
// Preserves the OWM condition codes so the existing ascii SCENE_MAP keeps working.

const WMO_MAP = {
  0: { id: 800, main: 'Clear', description: 'clear sky' },
  1: { id: 801, main: 'Clouds', description: 'mainly clear' },
  2: { id: 802, main: 'Clouds', description: 'partly cloudy' },
  3: { id: 804, main: 'Clouds', description: 'overcast' },
  45: { id: 741, main: 'Fog', description: 'fog' },
  48: { id: 741, main: 'Fog', description: 'depositing rime fog' },
  51: { id: 300, main: 'Drizzle', description: 'light drizzle' },
  53: { id: 301, main: 'Drizzle', description: 'moderate drizzle' },
  55: { id: 302, main: 'Drizzle', description: 'dense drizzle' },
  56: { id: 511, main: 'Drizzle', description: 'light freezing drizzle' },
  57: { id: 511, main: 'Drizzle', description: 'dense freezing drizzle' },
  61: { id: 500, main: 'Rain', description: 'slight rain' },
  63: { id: 501, main: 'Rain', description: 'moderate rain' },
  65: { id: 502, main: 'Rain', description: 'heavy rain' },
  66: { id: 511, main: 'Rain', description: 'light freezing rain' },
  67: { id: 511, main: 'Rain', description: 'heavy freezing rain' },
  71: { id: 600, main: 'Snow', description: 'slight snow fall' },
  73: { id: 601, main: 'Snow', description: 'moderate snow fall' },
  75: { id: 602, main: 'Snow', description: 'heavy snow fall' },
  77: { id: 611, main: 'Snow', description: 'snow grains' },
  80: { id: 520, main: 'Rain', description: 'slight rain showers' },
  81: { id: 521, main: 'Rain', description: 'moderate rain showers' },
  82: { id: 522, main: 'Rain', description: 'violent rain showers' },
  85: { id: 620, main: 'Snow', description: 'slight snow showers' },
  86: { id: 621, main: 'Snow', description: 'heavy snow showers' },
  95: { id: 200, main: 'Thunderstorm', description: 'thunderstorm' },
  96: { id: 211, main: 'Thunderstorm', description: 'thunderstorm with slight hail' },
  99: { id: 211, main: 'Thunderstorm', description: 'thunderstorm with heavy hail' }
};

const FALLBACK = { id: 804, main: 'Clouds', description: 'unknown' };

export function wmoToOwm(code) {
  return WMO_MAP[code] || FALLBACK;
}

// Open-Meteo `us_aqi` is 0–500 (US EPA scale). OWM's `aqi` is 1–5.
// Map by US-AQI breakpoints so existing getAirQualityDescription keeps working.
export function usAqiToOwmAqi(usAqi) {
  if (usAqi === null || usAqi === undefined || Number.isNaN(usAqi)) return null;
  if (usAqi <= 50) return 1;
  if (usAqi <= 100) return 2;
  if (usAqi <= 150) return 3;
  if (usAqi <= 200) return 4;
  return 5;
}
