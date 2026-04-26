# weather-cli-16bit v0.4.0

[![npm version](https://badge.fury.io/js/weather-cli-16bit.svg)](https://www.npmjs.com/package/weather-cli-16bit)
[![CI](https://github.com/deephouse23/weather-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/deephouse23/weather-cli/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)

Part of the 16bitweather suite of weather tools.

A command-line weather application with smart location parsing and responsive terminal display, powered by [Open-Meteo](https://open-meteo.com).

**No API key, no signup — just type `weather San Ramon CA` from anywhere on your system.**

## Installation

### NPM Global Install (Recommended)

```bash
npm install -g weather-cli-16bit
weather San Francisco CA
```

### From Source

```bash
git clone https://github.com/deephouse23/weather-cli.git
cd weather-cli
npm install
npm link
```

### Requirements

- Node.js v20.0.0 or higher

That's it — no API key required.

## Usage

### US States & Cities (no quotes needed)

```bash
weather CA                    # California
weather NY                    # New York
weather San Ramon CA          # San Ramon, California
weather San Francisco         # Auto-detects SF
```

### International

```bash
weather London                # Auto-detects UK
weather Tokyo                 # Auto-detects Japan
weather BC                    # British Columbia, Canada
weather Ontario               # Ontario, Canada
```

### All Commands

```bash
# Current weather
weather San Ramon             # City name
weather San Ramon CA          # City, State
weather London                # International
weather 94583                 # US Zip code

# Forecasts
weather forecast London       # 24-hour forecast
weather 5day Tokyo            # 5-day forecast

# Compare & coordinates
weather compare "New York" London
weather coords 37.7749,-122.4194

# ASCII Art (animated)
weather San Francisco --art --animate

# Interactive mode
weather                       # No arguments starts interactive mode

# Configuration & cache
weather config                # Set default location and units
weather cache                 # View cache statistics
weather cache -c              # Clear cache
```

### Temperature Units

```bash
# Automatic regional detection
weather London                # UK = Celsius
weather "New York"            # US = Fahrenheit

# Force specific units
weather Tokyo --celsius
weather Paris --fahrenheit
weather Berlin -u metric
weather Sydney -u imperial
```

## Display

```
╭──────────────────────────────────────────────────────────────────────────────────╮
│                                                                                  │
│   San Ramon, US                                    Sunrise: 06:16 AM             │
│   clear sky                                        Sunset: 08:10 PM              │
│   82°F                                             Air Quality: Good (AQI: 1)    │
│   Feels like: 82°F                                 Min: 73°F / Max: 88°F         │
│   Humidity: 44%                                     Wind: 5.99 mph               │
│   Pressure: 1015 hPa                                Visibility: 10km             │
│                                                                                  │
╰──────────────────────────────────────────────────────────────────────────────────╯
```

Responsive layout adapts to terminal width (compact, medium, and full views).

## Architecture

```
src/
├── weather.js           # Provider orchestration + unit auto-detect
├── cache.js             # Caching with expiration
├── display.js           # Terminal formatting and output
├── config.js            # Configuration management
├── api/
│   ├── http.js          # HTTP client with retry logic
│   ├── openmeteo.js     # Open-Meteo client + OWM-shape adapter
│   └── wmoToOwm.js      # WMO weather code + US-AQI normalization
└── utils/
    ├── errors.js        # Error handling utilities
    ├── locationParser.js # Smart location parsing
    └── validators.js    # Input validation

tests/unit/
├── cache.test.js        # Cache expiry, eviction, persistence
├── config.test.js       # Config load/save, temp options
├── display.test.js      # Formatting, air quality, data rows
├── errors.test.js       # WeatherError, exit code mapping
├── http.test.js         # Retry config, rate limiting
├── locationParser.test.js # 17 location format tests
├── validators.test.js   # Sanitization, coordinates, bounds
└── weather.test.js      # Unit detection, temp conversion
```

## Features

- **No API key required** — backed by Open-Meteo's free public API
- **Smart Location Parsing** — no quotes needed, supports US states, Canadian provinces, country codes
- **Smart Caching** — 30-minute expiry, 100-entry limit, LRU eviction
- **Responsive Display** — adapts to terminal width with color-coded output
- **Forecasts** — 24-hour and 5-day, city comparison, GPS coordinates
- **Retry Logic** — exponential backoff for network issues
- **Animated ASCII Art** — animated weather scenes with `--art --animate`

## Development

### Prerequisites

- Node.js v20+
- npm

### Scripts

```bash
npm test                 # Run all tests (Vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier format
npm run format:check     # Check formatting
npm run dev              # Dev mode with auto-restart
```

### Quality Tools

- **Vitest** — 104 unit tests across 8 test files
- **ESLint v9** — flat config with Prettier integration
- **Prettier** — consistent code formatting
- **Husky** — pre-commit hook runs lint-staged
- **GitHub Actions CI** — lint + test matrix (Node 20, 22, 24)

### Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/my-feature`
3. Run checks: `npm test && npm run lint`
4. Commit and push
5. Open PR — auto-publishes to npm when merged

## Command Reference

| Command                           | Description                |
| --------------------------------- | -------------------------- |
| `weather [location]`              | Current weather            |
| `weather now [location]`          | Current weather (explicit) |
| `weather forecast [location]`     | 24-hour forecast           |
| `weather 5day [location]`         | 5-day forecast             |
| `weather compare <city1> <city2>` | Compare two cities         |
| `weather coords <lat,lon>`        | Weather by GPS             |
| `weather config`                  | Set defaults               |
| `weather cache`                   | View cache stats           |
| `weather cache -c`                | Clear cache                |

### Options

| Option               | Description                              |
| -------------------- | ---------------------------------------- |
| `-u, --units <type>` | Temperature units (metric/imperial/auto) |
| `--celsius`          | Force Celsius display                    |
| `--fahrenheit`       | Force Fahrenheit display                 |
| `-f, --forecast`     | Include 24-hour forecast                 |
| `-a, --alerts`       | Show weather alerts                      |
| `--art`              | Display ASCII art weather scene          |
| `--animate`          | Animate the ASCII art scene              |

## License

MIT — see [LICENSE](LICENSE).

## Links

- **NPM**: [weather-cli-16bit](https://www.npmjs.com/package/weather-cli-16bit)
- **Homepage**: [16bitweather.co](https://16bitweather.co)
- **Repository**: [GitHub](https://github.com/deephouse23/weather-cli)
- **Issues**: [GitHub Issues](https://github.com/deephouse23/weather-cli/issues)
- **API**: [Open-Meteo](https://open-meteo.com) (free, no API key required)
