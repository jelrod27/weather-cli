# weather-cli-16bit

[![npm version](https://badge.fury.io/js/weather-cli-16bit.svg)](https://www.npmjs.com/package/weather-cli-16bit)
[![CI](https://github.com/jelrod27/weather-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/jelrod27/weather-cli/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)

Weather for your terminal: current conditions, forecasts, ASCII art, and a compact
status line for your shell prompt or tmux. Powered by
[Open-Meteo](https://open-meteo.com/), with **no API key or account required**.

Type a location naturally: `weather San Ramon CA` works without quotes.

## Install and get started

Requires **Node.js 20 or newer** and npm. Supports macOS, Linux, and Windows.

```bash
npm install -g weather-cli-16bit
weather San Ramon CA
weather London
weather 94583
```

The npm package is named `weather-cli-16bit`; the installed command is `weather`.

```bash
weather config                     # choose a default location, units, and cache lifetime
weather                            # interactive mode
weather --help                     # list commands and options
weather --version                  # show the installed version
```

To update an existing installation:

```bash
npm install -g weather-cli-16bit@latest
weather --version
```

Publishing a release does not automatically update an already installed CLI.

## Everyday examples

```bash
weather forecast Tokyo                     # next 24 hours
weather 5day Paris                          # five-day forecast
weather now "San Ramon CA" --fahrenheit     # force Fahrenheit
weather compare "New York" London          # compare two locations
weather coords 37.7749,-122.4194             # latitude and longitude
weather London --art                        # add an ASCII weather scene
weather London --art --animate              # animate the scene in an interactive terminal
weather now London --json                   # request JSON weather data
```

The root command accepts several location words without quotes. For subcommands,
quote locations containing spaces, such as `weather forecast "San Ramon CA"`.
Put options after the subcommand: `weather now London --fahrenheit --json`.

## Commands

| Command                                        | What it does                                                  |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `weather [location...]`                        | Show current conditions; no arguments starts interactive mode |
| `weather now [location]`                       | Show current conditions explicitly                            |
| `weather forecast [location]`                  | Show the next 24 hours                                        |
| `weather 5day [location]`                      | Show the five-day forecast                                    |
| `weather compare <city1> <city2>`              | Compare weather in two locations                              |
| `weather coords <lat,lon>`                     | Look up weather by coordinates                                |
| `weather radar [location]`                     | Show precipitation information for the next hour              |
| `weather watch [location]`                     | Refresh the weather display on an interval                    |
| `weather marine [location]`                    | Show wave and ocean conditions for a coastal location         |
| `weather history [location] --date YYYY-MM-DD` | Show historical weather for one date                          |
| `weather status [location...]`                 | Print a compact line for a shell prompt or tmux               |
| `weather config`                               | Set a default location, units, and cache lifetime             |
| `weather cache`                                | Show cache statistics                                         |
| `weather cache --clear`                        | Clear the cache (`-c` is the short form)                      |
| `weather cache --clean`                        | Remove expired cache entries                                  |
| `weather interactive` or `weather i`           | Start interactive mode                                        |

For commands with an optional location, set a default with `weather config` to
avoid supplying it each time. Run `weather <command> --help` for the options
supported by that command.

### Watch, marine, and historical weather

```bash
weather watch London --interval 5
weather marine "San Francisco"
weather history London --date 2025-07-15
```

Watch mode refreshes the display every five minutes by default; `--interval`
accepts 1–60 minutes. Press Ctrl+C to stop it. Reports still use the configured
cache lifetime, so a display refresh does not always make a new API request.

Marine data depends on the location and provider coverage. Historical weather
uses the Open-Meteo Archive API; choose a past date with available data.

## Units and JSON

Weather reports for named locations select units from the location automatically.
Coordinate lookups default to metric. On supported weather commands, override
the units with:

| Option                              | Value                   |
| ----------------------------------- | ----------------------- |
| `--celsius`                         | Celsius temperatures    |
| `--fahrenheit`                      | Fahrenheit temperatures |
| `-u metric` or `--units metric`     | Metric units            |
| `-u imperial` or `--units imperial` | Imperial units          |

Marine and historical weather currently use metric units.

Current weather, forecast, coordinates, radar, watch, and marine commands support
`--json`. Check a command's help before combining options.

```bash
weather London --celsius
weather forecast Tokyo --json
weather marine "San Francisco" --json
```

## ASCII art and themes

```bash
weather London --art
weather London --art-only
weather London --art-style retro
weather --list-themes
weather --preview-themes
```

`--art-style` accepts a named theme or `random`. The `default` theme chooses day
or night colors automatically. Add `--animate` for animation in an interactive
terminal, or `--no-art` to disable art for a command.

## Shell prompt and tmux

`weather status` reads the local cache by default, without a weather API request
or spinner. It exits with code `1` when the requested report is missing or stale,
allowing your prompt to omit the weather until the cache is refreshed.

Set a default location and fetch its report first:

```bash
weather config
weather London                         # use the location you set as your default
weather status
weather status --format compact
weather status --format minimal
```

You can also pass a location directly: `weather status London`. Add `--refresh`
to fetch data if the report is missing or stale.

For Starship, add this to `~/.config/starship.toml`:

```toml
[custom.weather]
command = "weather status --format compact"
when = "weather status --format compact"
format = "[$output]($style) "
```

For tmux, add this to `~/.tmux.conf`:

```text
set -g status-right '#(weather status --format compact) | %H:%M'
```

## Configuration and caching

`weather config` prompts for a default location, temperature units, and a cache
lifetime between 1 and 1,440 minutes. The default cache lifetime is 30 minutes.
Current-weather and forecast commands reuse a cached report for the same
location and unit preference until it expires.

The default files are:

| File                                | Purpose                |
| ----------------------------------- | ---------------------- |
| `~/.config/weather-cli/config.json` | User preferences       |
| `~/.cache/weather-cli/cache.json`   | Cached weather reports |

`XDG_CONFIG_HOME` and `XDG_CACHE_HOME` override those base directories. Use
`weather cache --clear` to discard cached reports before the next lookup.

## Releases and this README

This repository uses **one root `README.md` for both GitHub and npm**. GitHub
shows changes when they reach the repository. npm shows the README included in a
published package; editing GitHub alone does not update the npm page.

After a PR is merged to `main` and its CI checks pass, the release workflow
publishes a new npm patch version and creates a matching GitHub Release. A
README-only merge follows the same process. Unmerged PRs and feature branches
are not published, and npm can take a few minutes to finish processing a release.

The package contains the CLI, its source, and the README, license, and changelog
listed in `package.json`. It does not contain the entire GitHub repository:
tests, workflow files, issues, and PR discussions do not ship with the package.

See the [release guide](https://github.com/jelrod27/weather-cli/blob/main/docs/releasing.md)
for versioning, trusted publishing, and retries, or browse
[GitHub Releases](https://github.com/jelrod27/weather-cli/releases) for published versions.

## Development

```bash
git clone https://github.com/jelrod27/weather-cli.git
cd weather-cli
npm ci
npm link
```

| Command                 | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `npm test`              | Run the test suite once                  |
| `npm run test:watch`    | Watch tests while developing             |
| `npm run test:coverage` | Check coverage                           |
| `npm run lint`          | Run ESLint                               |
| `npm run format:check`  | Check formatting                         |
| `npm run format`        | Format files with Prettier               |
| `npm run dev`           | Restart the CLI when source files change |

CI runs lint, formatting, coverage, secret scanning, and tests on Node 20, 22,
and 24. Contribute through a PR to `main`.

## Links and license

- [npm package](https://www.npmjs.com/package/weather-cli-16bit)
- [Source code](https://github.com/jelrod27/weather-cli)
- [Report an issue](https://github.com/jelrod27/weather-cli/issues)
- [Changelog](https://github.com/jelrod27/weather-cli/blob/main/CHANGELOG.md)
- [Open-Meteo](https://open-meteo.com/)
- [16bitweather](https://16bitweather.co/)

MIT — see the [license](https://github.com/jelrod27/weather-cli/blob/main/LICENSE).
