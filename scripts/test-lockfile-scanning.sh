#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
config_file=${1:-"$repo_dir/.gitleaks-lockfiles.toml"}
fixture_dir=$(mktemp -d)
trap 'rm -rf "$fixture_dir"' EXIT
fixture="$fixture_dir/package-lock.json"
report="$fixture_dir/findings.json"
git -C "$fixture_dir" init --quiet

printf '%s\n' '{"lockfileVersion":3,"packages":{"":{"integrity":"sha512-public-metadata"}}}' > "$fixture"
gitleaks dir --config "$config_file" --redact --no-banner "$fixture" >/dev/null 2>&1
git -C "$fixture_dir" add package-lock.json
gitleaks git --pre-commit --staged --config "$config_file" --redact --no-banner "$fixture_dir" >/dev/null 2>&1

assert_credential_rejected() {
  local credential=$1
  shift
  local scan_exit=0
  rm -f "$report"
  gitleaks "$@" --config "$config_file" --redact --no-banner --report-format json --report-path "$report" >/dev/null 2>&1 || scan_exit=$?
  if [ "$scan_exit" -ne 1 ] || ! grep -q '"RuleID": "lockfile-' "$report"; then
    echo "Lockfile scan did not report $credential as a credential finding" >&2
    exit 1
  fi
}

for credential in npm-token auth-token basic-auth registry-password; do
  case "$credential" in
    npm-token) printf '{"resolved":"npm_%s"}\n' 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4zAB7C' > "$fixture" ;;
    auth-token) printf '%s\n' '{"_authToken":"synthetic-registry-credential"}' > "$fixture" ;;
    basic-auth) printf '{"_auth":"%s%s"}\n' 'c3ludGhldGlj' 'OnNlY3JldA==' > "$fixture" ;;
    registry-password) printf '%s\n' '{"password":"synthetic-registry-password"}' > "$fixture" ;;
  esac
  assert_credential_rejected "$credential" dir "$fixture"

  # A clean working copy must not hide a credential already staged for commit.
  git -C "$fixture_dir" add package-lock.json
  printf '%s\n' '{"lockfileVersion":3}' > "$fixture"
  assert_credential_rejected "staged $credential" git --pre-commit --staged "$fixture_dir"
done

echo 'Lockfile scanning allows public metadata and rejects credential fixtures.'
