# Dead Code Cleanup Plan — weather-cli

## Goal

Remove dead code, unused exports, unused dependencies, and migration remnants from the weather-cli codebase. Reduce bundle size, improve maintainability, and eliminate confusion from OWM-era artifacts.

## Audit Findings (organized by priority)

### P0 — Definitely Dead (remove)

1. **`formatWindDirection()` in `src/display.js` (~line 46)**
   - Defined but never called anywhere. Wind display uses `degToArrow()` directly.
   - Action: Delete the function entirely.

2. **`setAsciiConfig()` in `src/config.js` (~line 88)**
   - Exported but never imported outside tests. `index.js` writes ascii config inline.
   - Action: Remove from exports. If tests need it, they can test via `saveConfig` + `loadConfig` or inline.

3. **`@playwright/test` and `playwright` in `package.json` devDependencies**
   - No E2E tests exist. No playwright config. Pure dead weight.
   - Action: `npm uninstall @playwright/test playwright`

4. **`husky` in `package.json` devDependencies**
   - Listed but no `.husky/` directory and no git hooks configured. `lint-staged` runs via the `prepare` script but has no hook to trigger it.
   - Action: Either set up husky properly OR remove it. Recommend removing — the CI already runs lint/format checks, and `lint-staged` runs via the pre-commit hook in `.pre-commit-config.yaml` (if configured). Check if `.pre-commit-config.yaml` references lint-staged.

### P1 — Test-Only Exports (keep with `_` prefix or internalize)

These exports are only imported by tests. Options: (A) keep as-is (it's fine for a CLI tool), (B) prefix with `_`, (C) move to a `test-helpers.js` file, (D) make them non-exported and test via integration.

5. **`celsiusToFahrenheit()`, `fahrenheitToCelsius()`, `convertTemperature()` in `src/weather.js`**
   - Only used in tests, not in production code.
   - Action: These are reasonable test-only exports. Keep them — they're small utility functions with potential future use.

6. **`loadCache()`, `saveCache()` in `src/cache.js`**
   - Only used in tests, not production imports.
   - Action: Keep — testing internal behavior requires these.

7. **`loadConfig()`, `saveConfig()` in `src/config.js`**
   - Only used in tests, not production imports.
   - Action: Keep — same reasoning.

8. **`formatTemp`, `formatTime`, `formatWindSpeed`, `formatVisibility`, `getAirQualityDescription`, `createDataRow` in `src/display.js`**
   - All exported, only used internally or in tests.
   - Action: Keep exports but they could be internal-only in a future refactor. Not urgent.

### P2 — Architecture Remnants (informational, not removing)

9. **OWM-shaped data structure throughout (`wmoToOwm.js`, `openmeteo.js`, `display.js`, `icons.js`)**
   - The entire display layer uses `weather.main`, `weather.weather[0].main`, `weather.sys.sunrise` etc. — all OWM property names. `wmoToOwm.js` converts WMO codes into OWM code enums. `openmeteo.js` builds OWM-shaped response objects.
   - This is a significant migration artifact but it WORKS. Refactoring to native Open-Meteo shapes would touch every file and every test.
   - Action: None now. Flag for a future v1.0 refactor if desired.

10. **`__resetForTesting()` exports in `src/config.js` and `src/cache.js`**
    - Test-only helpers, appropriately named convention.
    - Action: Keep. Standard pattern for testing stateful modules.

11. **Naming: `usAqiToOwmAqi`, `wmoToOwm`, etc.**
    - Functions still reference "OWM" in their names despite using Open-Meteo.
    - Action: Low priority rename if desired in a future refactor. Not breaking anything.

## Execution Plan

### Step 1: Remove `formatWindDirection()`

- File: `src/display.js`
- Delete the function and its JSDoc
- Verify no test references it (grep for `formatWindDirection`)

### Step 2: Remove `setAsciiConfig()` from `src/config.js`

- Delete the function
- Remove from the `export` statement
- Check tests — if any test imports it, update to use direct config manipulation

### Step 3: Remove `@playwright/test` and `playwright`

- Run: `npm uninstall @playwright/test playwright`
- Verify `npm test` still passes

### Step 4: Evaluate `husky`

- Check `.pre-commit-config.yaml` for lint-staged integration
- If no hooks configured, remove husky: `npm uninstall husky`
- Also remove the `prepare` script referencing husky if removed

### Step 5: Cleanup the `formatWindDirection` test

- If `display.test.js` has tests for `formatWindDirection`, remove those too

### Step 6: Run full gates

- `npm run format`
- `npm run lint`
- `npm test`
- `./smoke-test.sh`

### Step 7: Commit, push, PR

- Branch: `chore/dead-code-cleanup`
- Conventional commit: `chore: remove dead code, unused deps`
- Open PR immediately

## Files Likely to Change

- `src/display.js` — remove `formatWindDirection`
- `src/config.js` — remove `setAsciiConfig`
- `tests/unit/display.test.js` — remove tests for deleted function
- `tests/unit/config.test.js` — remove tests for deleted function (if any)
- `package.json` — remove playwright, possibly husky
- `package-lock.json` — regenerated by npm uninstall

## Risks / Open Questions

- **OWM-shaped data**: Not removing it, just noting it. Future refactor opportunity.
- **Test-only exports**: Keeping them. They don't bloat the bundle (tree-shaken in ESM) and they're useful for testing.
- **husky**: Need to verify `.pre-commit-config.yaml` setup before removing.
