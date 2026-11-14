# Automatic npm releases implementation plan

**Goal:** Publish each successful merge to `main` with a fresh patch version.

**Architecture:** Reuse successful push CI as the release gate. A dependency-free
Node helper plans the version, records the source commit, and updates build-only
package metadata. Separate jobs validate, publish the tarball, and create a release.

**Tech stack:** Node 24, existing Vitest, GitHub Actions, npm trusted publishing.

**Spec:** `docs/superpowers/specs/2026-11-14-automatic-npm-releases-design.md`.

## Constraints and review focus

No new project dependencies or commits to `main`. Preserve existing CI and
unrelated checkout files. Test unused versions, manual minor/major bumps,
retries after publication, out-of-order CI, and invalid registry data.

## Implementation

- [x] Add failing release-plan tests in `tests/unit/release.test.js`.
- [x] Implement selection and build metadata in `scripts/prepare-release.js`.
- [x] Replace the trigger and wire least-privilege release jobs in
      `.github/workflows/npm-publish.yml`.
- [x] Document npm trusted publisher settings and retries in `docs/releasing.md`;
      link the guide from `README.md`.
- [x] Run full tests, lint, formatting, package smoke check, and pre-commit hooks.
- [x] Request independent review, resolve findings, and prepare the PR for Justin.
