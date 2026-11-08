# weather-cli-16bit v0.4.0

[![npm version](https://badge.fury.io/js/weather-cli-16bit.svg)](https://www.npmjs.com/package/weather-cli-16bit)
[![CI](https://github.com/jelrod27/weather-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/jelrod27/weather-cli/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)

An Open-Meteo CLI that parses location words without quotes — `weather San Ramon CA` just works.

**No API key, no signup — powered by [Open-Meteo](https://open-meteo.com).**

## Install

```bash
npm install -g weather-cli-16bit
```

Requires Node.js 20+.

## Usage

```bash
weather                         # interactive mode
weather San Ramon CA            # current weather
weather London                  # international
weather 94583                   # US ZIP
weather forecast Tokyo          # 24-hour forecast
weather 5day Paris              # 5-day forecast
weather compare "New York" London
weather coords 37.7749,-122.4194
weather --art --animate         # ASCII art scene
```

Units default to the region (°F in the US, °C elsewhere). Override with `--celsius`, `--fahrenheit`, or `-u metric|imperial`. Every call prefetches current + 24h + 5day + air-quality in one round-trip; subsequent commands for the same location in the next 30 min hit the local cache and return instantly.

## Output

```
╭──────────────────────────────────────────────────────────────────────────────────╮
│   San Ramon, US                                                                  │
│                                                                                  │
│   clear sky                             Sunrise:     06:16 AM                    │
│   82°F                                  Sunset:      08:10 PM                    │
│   Feels like: 82°F                      Air Quality: Good (AQI: 1)               │
│   Humidity:   44%                       Min/Max:     73°F / 88°F                 │
│   Pressure:   1015 hPa                  Wind:        5.99 mph @ 210°             │
│                                         Visibility:  10.0 km                     │
╰──────────────────────────────────────────────────────────────────────────────────╯
```

Layout collapses to a single column below ~68 cols.

## Shell prompt / tmux

`weather status` emits a single line and exits fast, reading only from the local cache. Safe to call on every prompt redraw — no network, no spinner. Exits `1` when the cache is cold so your prompt skips rendering.

```bash
weather status                   # ☀️ San Ramon 82°F ↑89 ↓73
weather status --format compact  # ☀️ 82°F
weather status --format minimal  # 82°F
weather status --no-emoji        # San Ramon 82°F ↑89 ↓73
```

Wire it into starship (`~/.config/starship.toml`):

```toml
[custom.weather]
command = "weather status --format compact"
when = "weather status --format compact"
format = "[$output]($style) "
```

Or tmux (`~/.tmux.conf`):

```
set -g status-right '#(weather status --format compact) | %H:%M'
```

Run `weather <location>` once to warm the cache. Subsequent `weather status` calls are free until the 30-min TTL expires.

## Commands

| Command                           | Description                        |
| --------------------------------- | ---------------------------------- |
| `weather [location]`              | Current weather (default)          |
| `weather now [location]`          | Current weather (explicit)         |
| `weather forecast [location]`     | 24-hour forecast                   |
| `weather 5day [location]`         | 5-day forecast                     |
| `weather compare <city1> <city2>` | Compare two cities                 |
| `weather coords <lat,lon>`        | Weather by GPS coordinates         |
| `weather status [location]`       | One-line output for prompts / tmux |
| `weather config`                  | Set default location and units     |
| `weather cache [-c\|--clean]`     | View / clear / prune the cache     |
| `weather interactive` / `i`       | Force interactive prompts          |

## Options

| Option               | Description                                   |
| -------------------- | --------------------------------------------- |
| `-u, --units <type>` | `metric`, `imperial`, `celsius`, `fahrenheit` |
| `--celsius`          | Force °C                                      |
| `--fahrenheit`       | Force °F                                      |
| `-f, --forecast`     | Append 24-hour forecast to current weather    |
| `--art`              | Render ASCII art scene above the weather box  |
| `--art-only`         | Render only the ASCII art                     |
| `--art-style <name>` | `default` or `retro`                          |
| `--animate`          | Animate the scene (interactive TTY only)      |

## Development

```bash
git clone https://github.com/jelrod27/weather-cli.git
cd weather-cli
npm install
npm link                 # expose the `weather` binary locally
```

Scripts:

```
npm test             vitest
npm run test:watch   vitest --watch
npm run lint         eslint .
npm run format       prettier --write .
npm run dev          node --watch bin/weather.js
```

Stack: Vitest, ESLint (flat config), Prettier, Husky + lint-staged, Axios, Commander, Inquirer, boxen, chalk.

CI runs lint + the test suite on Node 20/22/24.

## License

MIT — see [LICENSE](LICENSE).

## Links

- npm: [weather-cli-16bit](https://www.npmjs.com/package/weather-cli-16bit)
- Repo: [github.com/jelrod27/weather-cli](https://github.com/jelrod27/weather-cli)
- API: [Open-Meteo](https://open-meteo.com) (free, no API key required)
