# CONTEXT.md — weather-cli-16bit domain glossary

> The ubiquitous language for weather-cli. Use these terms in issues, PRs,
> tests, and code. Add terms here when they get resolved in conversation
> (see `/domain-modeling`).

## Core concepts

**Location** — a place the user asks about. Parsed from raw CLI words
(`"San Ramon CA"`) into a query, then geocoded to `{ lat, lon, country, admin1 }`.
Owned by the `geocode` module (`src/api/geocode.js`).

**WeatherReport** — the canonical data object that flows from the API layer
to the display layer. Built by `normalizeToOwmShape` in `src/weatherReport.js`.
Consumed by `display.js` and `status.js`. Includes current conditions, forecast
list, air quality, alerts, minutely precipitation, and display metadata.

**Forecast** — the 3-hour-period list inside a WeatherReport
(`data.forecast.list[]`). Each entry has `dt`, `main` (temp, humidity, pressure),
`weather` (condition code + description), `wind`, and `aqi`.

**Current** — the real-time weather snapshot inside a WeatherReport
(`data.current`). Includes temperature, feels-like, humidity, pressure, wind,
UV index, visibility, dew point, cloud cover, CAPE, solar radiation, and
pressure trend.

**Alert** — a severe weather notice from the Open-Meteo alerts endpoint.
Has `headline`, `severity`, `urgency`, and `description`. Sorted and rendered
above the main weather box.

**Scene** — an ASCII art rendering of a weather condition (sunny, cloudy,
rain, snow, thunder, fog, night-clear). Selected by `getScene(conditionCode,
weatherData)` from `src/ascii/index.js`. Each scene has art frames, character
colors, and optional animation support.

**Palette** — a named color scheme for ASCII art scenes (day, night, retro,
dracula, solarized, nord, etc.). Maps semantic keys (sky, sun, cloud, ground,
houseRoof, etc.) to hex colors. Owned by `src/ascii/palette.js`.

## Display layer

**Formatter** — a pure function that converts a raw data value to a display
string (e.g. `formatTemp`, `formatWindSpeed`, `formatDewPoint`). Owned by
`src/formatters.js`. Internal to the display module — callers should use the
render entry points, not import formatters directly.

**Render entry point** — one of the 5 public display functions:
`displayCurrentWeather`, `display5DayForecast`, `display24HourForecast`,
`displayAlerts`, `displayMinutelyForecast`. These are the interface of the
display module.

## Units

**Unit system** — the temperature/wind unit pair used for a request. Either
`metric` (celsius, m/s) or `imperial` (fahrenheit, mph). Resolved by
`determineDisplayUnits(countryCode, userPreference)` in `src/units.js`.

**Display unit** — the temperature unit shown to the user (`celsius` or
`fahrenheit`). Stored as `data.displayUnit` on the WeatherReport after
normalization.

## Infrastructure

**Cache** — JSON-file LRU cache at `~/.cache/weather-cli/cache.json`. Entries
keyed by `location-units`, with TTL (default 30 min), 100-entry cap, 7-day max
age, and `schemaVersion` for invalidation. Owned by `src/cache.js`.

**Config** — JSON-file user settings at `~/.config/weather-cli/config.json`.
Stores `defaultLocation`, `defaultUnits`, `cacheTtl`, and `ascii` preferences.
Owned by `src/config.js`.

**HTTP client** — a shared axios instance with retry, rate-limit handling,
timeout, and request ID injection. Owned by `src/api/http.js`. All outbound
HTTP should use this client, not import axios directly.
