# ADR-0001: Deepen modules — extract formatters, WeatherReport, commands, units, geocode

Date: 2026-08-01

## Status

Accepted

## Context

An architecture review (using the `improve-codebase-architecture` skill) found
five shallow modules causing friction:

1. **display.js** — 824 lines, 22 exports. Formatters and renderers all public.
   The interface was nearly as wide as the implementation. `status.js`
   duplicated formatting logic instead of importing it.
2. **normalizeToOwmShape** — built an OWM-shaped object with no type, no module
   owning it. Every consumer read it by raw key path (`data.current.main.temp`).
   The shape leaked across every seam.
3. **index.js** — 548 lines wiring 12+ commands inline with duplicated
   patterns (resolveLocation → fetchWithCache → display). All surface, no
   depth.
4. **Units logic** — scattered across `weather.js`, `display.js`, and
   `config.js`. No home — it leaked across three modules.
5. **geocode** — location parsing split across `locationParser.js` and
   `openmeteo.js`. Two parsers, two seams, one concept.

## Decision

Deepen each module by extracting behavior into dedicated modules with small
interfaces:

- `src/formatters.js` — pure formatting functions (from display.js)
- `src/weatherReport.js` — WeatherReport shape + normalizeToOwmShape (from
  openmeteo.js)
- `src/commands/index.js` — command registration with `registerAll` (from
  index.js)
- `src/units.js` — unit conversion + resolution (from weather.js + config.js)
- `src/api/geocode.js` — location parsing + geocoding (from openmeteo.js +
  locationParser.js)

All existing exports preserved via re-exports for backward compatibility.
629 tests pass at every commit.

## Consequences

- Module interfaces are smaller and more intentional
- Bugs and changes concentrate in one module (locality)
- One interface serves N call sites (leverage)
- The WeatherReport shape has a home and can evolve independently of consumers
- Adding a command touches one file, not a 548-line monolith
- Future architecture reviews can use CONTEXT.md vocabulary instead of
  generic terms
