# AGENTS.md — weather-cli

## Purpose

weather-cli is a Node.js command-line weather client powered by the Open-Meteo API (no API key required). It is the primary repo serviced by the Spectra AI engineer profile.

## Tech Stack

- Node.js >= 20 (ESM only)
- Commander.js for CLI argument parsing
- Open-Meteo API for weather data (geocoding, forecast, air-quality normalized to OWM shape)
- Vitest for testing
- ESLint (flat config) + Prettier for linting/formatting
- Pre-commit + Gitleaks for secret scanning and general hygiene
- Husky + lint-staged is legacy and may coexist until migrated

## Repository Structure

- `bin/weather.js` — published binary wrapper
- `index.js` — CLI entry point (Commander program wiring)
- `src/api/` — HTTP client, Open-Meteo adapter, WMO-to-OWM mapping
- `src/ascii/` — ASCII art scenes and renderer
- `src/cache.js` — JSON-file LRU cache (`.weather-cache.json`)
- `src/config.js` — JSON-file user config (`.weather-config.json`)
- `src/utils/` — errors, formatting, helpers
- `tests/unit/` — Vitest unit tests
- `.github/workflows/ci.yml` — CI (lint + format check + test matrix Node 20/22/24 + gitleaks)
- `.github/workflows/npm-publish.yml` — publish to npm on version bump

## Commands

```bash
npm install              # Install dependencies
npm start                # Run CLI (node bin/weather.js)
npm run dev              # Auto-restart with node --watch
npm test                 # Vitest single run (CI uses this)
npm run test:watch       # Vitest watch
npm run test:coverage    # With coverage
npm run lint             # ESLint
npm run lint:fix         # ESLint --fix
npm run format           # Prettier write
npm run format:check     # Prettier check
```

Pre-commit hooks (after `pre-commit install`):

```bash
pre-commit run --all-files   # Run all hooks manually
```

## Branch Convention

All branches must use a conventional prefix:

- `feat/` — new features
- `fix/` — bug fixes
- `chore/` — tooling, config, maintenance
- `refactor/` — code changes without new features
- `docs/` — documentation only
- `test/` — test-only changes

Never commit directly to `main`. All work goes through a PR.

## Definition of Done

A PR is done when:

1. All tests pass locally (`npm test`)
2. Pre-commit hooks pass (`pre-commit run --all-files`)
3. CI is green on the PR (lint, format-check, tests on Node 20/22/24, gitleaks)
4. Justin has previewed and approved
5. Squash-merged to `main`

## Out of Scope (Standing Rules)

- Do not modify `.github/workflows/`, `.pre-commit-config.yaml`, branch protection, or this file without an explicit approved task.
- Do not touch other repos.
- Do not modify billing, auth, or deployment config.
- Do not add new dependencies without Justin’s approval in the PRD.
- No emoji in commits, PR titles, PR bodies, AGENTS.md, or status reports.
- No secrets in commits, ever, including feature branches.

## Risk and Rollback

- Branch protection can be reverted via GitHub UI or `gh api`.
- Pre-commit can be uninstalled with `pre-commit uninstall`.
- All changes in this repo are additive or config-only; rollback is a revert away.
