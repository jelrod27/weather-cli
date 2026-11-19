#!/bin/bash
set -euo pipefail

temp_root=$(CDPATH= cd -- "${TMPDIR:-/tmp}" && pwd -P)
CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
smoke_dir=$(mktemp -d "$temp_root/weather-cli-smoke.XXXXXXXX")
trap 'rm -r -- "$smoke_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

expected_version=$(node -p "require('./package.json').version")
HUSKY=0 npm pack --loglevel=error --pack-destination "$smoke_dir"
cp scripts/smoke-forecast-fixture.js "$smoke_dir/smoke-forecast-fixture.mjs"

cd -- "$smoke_dir"
# The preload and installed CLI must import the same copy of Axios.
npm install --prefix "$smoke_dir" --global=false \
  --ignore-scripts --no-save --no-package-lock --no-audit --no-fund \
  --install-strategy=hoisted ./*.tgz
weather=./node_modules/.bin/weather
export XDG_CONFIG_HOME="$smoke_dir/config"
export XDG_CACHE_HOME="$smoke_dir/cache"

help=$("$weather" --help)
if [[ "$help" != "Usage: weather "* ]] || ! grep -Eq '^[[:blank:]]+forecast[[:blank:]]' <<< "$help"; then
  printf 'Unexpected weather --help output\n%s\n' "$help" >&2
  exit 1
fi
printf 'Passed weather --help\n'

version=$("$weather" --version)
if [[ "$version" != "$expected_version" ]]; then
  printf 'Expected weather --version to print %s, got %s\n' "$expected_version" "$version" >&2
  exit 1
fi
printf 'Passed weather --version (%s)\n' "$version"

NODE_OPTIONS=--import=./smoke-forecast-fixture.mjs \
  "$weather" forecast San Ramon CA --json > forecast.json
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('forecast.json', 'utf8'));
assert.equal(report.current?.name, 'San Ramon', 'Expected the San Ramon forecast');
assert.equal(report.current?.sys?.country, 'US', 'Expected California, US');
assert.deepEqual(report.current?.coord, { lat: 37.78, lon: -121.98 });
assert.equal(report.displayUnit, 'fahrenheit');
assert.equal(report.forecast?.list?.[0]?.main?.temp, 71, 'Expected the fixture forecast');
JS
printf 'Passed weather forecast San Ramon CA --json\n'
