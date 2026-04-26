# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # Install deps (Node >= 20 required)
npm start                # Run CLI via bin/weather.js
npm run dev              # Auto-restart with node --watch
npm test                 # Vitest, single run (CI uses this)
npm run test:watch       # Vitest watch
npm run test:coverage    # With coverage
npx vitest run tests/unit/cache.test.js   # Single test file
npm run lint             # ESLint (flat config in eslint.config.js)
npm run lint:fix
npm run format           # Prettier write
npm run format:check
```

A `pre-commit` Husky hook runs `lint-staged` (eslint --fix + prettier --write on staged JS).

## Big-picture architecture

### Entry points

- **`bin/weather.js`** is the published binary (`"bin": { "weather": "./bin/weather.js" }`). It is a thin wrapper that dynamically imports `../index.js` via `pathToFileURL` for cross-platform support. Any new top-level startup logic belongs in `index.js`, not `bin/weather.js`.
- **`index.js`** wires up the `commander` program: top-level variadic `[location...]` action, plus subcommands (`now`, `forecast`, `5day`, `compare`, `coords`, `config`, `cache`, `interactive`/`i`). All commands flow through `withUnitOptions(withArtOptions(...))` helpers — when adding a new command, reuse those wrappers so unit and art flags stay consistent.
- The default action with **no args** drops into `inquirer` interactive mode. With args, location words are joined and run through `parseLocation()`.

### Data source: Open-Meteo (src/api/openmeteo.js)

Three endpoints per request:

1. `geocoding-api.open-meteo.com/v1/search` — resolves a location string to `{ lat, lon, country, admin1, name }`. The country code (ISO 3166-1 alpha-2) is what drives unit auto-detect (`FAHRENHEIT_COUNTRIES` = US, BS, BZ, KY, PW).
2. `api.open-meteo.com/v1/forecast` — current + hourly + daily blocks. We pass `temperature_unit=celsius|fahrenheit` and `wind_speed_unit=ms|mph` upfront so no client-side conversion is needed.
3. `air-quality-api.open-meteo.com/v1/air-quality` — `current=us_aqi`. Failures are swallowed (AQ is non-essential).

The forecast and AQ calls run in parallel via `Promise.all`. Geocoding must complete first (it determines lat/lon and the unit-detection country code). No API key is sent.

### OWM-shape adapter

`display.js` and `src/ascii/index.js` `SCENE_MAP` were originally written against OpenWeatherMap's response shape and condition codes. Rather than rewrite both, **`normalizeToOwmShape()` in `src/api/openmeteo.js` translates Open-Meteo responses into that exact shape** (`current.weather[0].id`, `current.main.temp`, `current.sys.country/sunrise/sunset`, `forecast.list[]`, `pollution.list[0].main.aqi`, etc.). Two helpers in `src/api/wmoToOwm.js` do the heavy lifting:

- `wmoToOwm(wmoCode)` — WMO weather codes (0–99) → OWM-shape `{ id, main, description }` so existing `SCENE_MAP[id]` keeps resolving.
- `usAqiToOwmAqi(usAqi)` — US-AQI 0–500 → OWM 1–5 by EPA breakpoints (≤50→1, ≤100→2, ≤150→3, ≤200→4, >200→5).

When extending the data we read from Open-Meteo, prefer to **add to the adapter** rather than touch `display.js`.

### Coordinates mode

Open-Meteo has no reverse-geocoding API. `getWeatherByCoords()` therefore labels the location as `"lat, lon"`, leaves `country` empty, and skips country-based unit auto-detect (defaults to celsius unless the user passed `--fahrenheit`/`-u`). Display falls back to a country-less header in this mode.

The cache key includes `userUnits || 'auto'`, so cached entries are unit-specific and the auto-detect path caches separately from explicit overrides.

### Errors and exit codes (src/utils/errors.js)

All thrown errors should be `WeatherError` with a code from `ERROR_CODES`. `mapErrorToExitCode()` maps codes to deterministic exit codes (3 = location, 4 = network, 5 = rate limit, 6 = invalid input, 1 = anything else). Exit code 2 (formerly auth) was retired in 0.4.0 along with the API-key code path. Tests and shell scripts depend on these — don't change them casually.

### HTTP layer (src/api/http.js)

Single shared `axios` instance with 5 s timeout, `User-Agent: weather-cli/<version>` (read from `package.json`), per-request `X-Request-ID` header, and `axios-retry` configured for 3 retries on network errors, 5xx, and 429 with exponential backoff. A response interceptor rewrites 429 messages to include `Retry-After`. Use this client (`./api/http.js` default export) for any new outbound HTTP — don't import `axios` directly.

### Cache (src/cache.js)

JSON file at repo root: `.weather-cache.json`. 30-min entry expiry, 100-entry cap, 7-day hard max age, in-memory `accessOrder` array for LRU eviction. `accessOrder` is module-scoped so it's only meaningful within a single CLI invocation — across invocations LRU degrades to "first 100 surviving entries kept."

Each cache entry carries a `schemaVersion` field. Bump `CACHE_SCHEMA_VERSION` in `src/cache.js` whenever the cached `data` shape changes — older entries are silently skipped on read. Current value: `2` (post-Open-Meteo cutover).

### ASCII art subsystem (src/ascii/)

`getScene(conditionCode, weatherData)` maps OWM condition codes → scene modules in `src/ascii/scenes/`. Code 800 (clear) flips to `night-clear` based on `isDaytime()` (compares `dt` to `sys.sunrise`/`sys.sunset`). Rendered by `AsciiRenderer` from `display.js`. New conditions need to be added to `SCENE_MAP` in `src/ascii/index.js` or they fall back to `cloudy`.

### Config (src/config.js)

JSON file at repo root: `.weather-config.json`. Stores `defaultLocation`, `defaultUnits`, and `ascii: { enabled, style }`. `processTemperatureOptions()` is the single source of truth for resolving CLI flags into a unit string — call it instead of inspecting `options.celsius`/`options.fahrenheit`/`options.units` directly.

## CI / publish flow

- **`.github/workflows/ci.yml`** — lint + format check on Node 20, tests on Node 20/22/24.
- **`.github/workflows/npm-publish.yml`** — on PR merge to `main`/`master`, compares `package.json` version to npm registry version. If they differ, runs tests and `npm publish`, then creates a GitHub release. **Bumping `package.json` version is therefore the trigger to publish.** Don't bump version in casual PRs.

## Module conventions

- **ESM only** (`"type": "module"`). Use `import`/`export`, no `require`.
- Get `__dirname` via `dirname(fileURLToPath(import.meta.url))` — this pattern is reused across `index.js`, `cache.js`, `config.js`, and `http.js`.
- Spinner pattern: create `ora('...').start()` inside the API call, `succeed`/`fail` it before returning/throwing.
- Tests live in `tests/unit/*.test.js` (vitest config restricts to `tests/**/*.test.js`). `globals: true` is set, so `describe`/`it`/`expect` are available without import.
- `tests/*.spec.js` files (`simple-weather-test.spec.js`, `weather-validation.spec.js`) are Playwright-style specs and **not** picked up by Vitest. There is a `playwright.config.{js,cjs}` but no `playwright` script in `package.json` — these aren't part of normal CI.
