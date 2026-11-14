# npm releases

Every push to `main` whose **CI** workflow succeeds triggers **NPM Publish**.
This includes a merged PR. Pull request checks, failed CI, and branch pushes do
not publish. The release uses the exact commit that passed the complete CI
workflow, including the Node 20/22/24 test matrix, lint, formatting, coverage,
and secret scanning.

## Versions

Automatic releases increment the patch: `0.5.1`, `0.5.2`, `0.5.3`, and so on.
Versions such as `0.5.01` are invalid because semantic versions forbid leading
zeros. The release selects the next unused patch above all stable npm versions
and Git tags. Existing `v0.5.0` makes the first automatic release `0.5.1`, even
though npm was last published as `0.3.60`.

The tracked `package.json` version is a minimum for the release line. For a
deliberate feature or breaking-change release, update it and the lockfile in a
PR with `npm version minor --no-git-tag-version` or
`npm version major --no-git-tag-version`. If that version is still unused, the
next release uses it exactly. Review breaking changes explicitly before picking
the release line, especially while the package is pre-1.0.

CI updates the build checkout's manifest and both lockfile versions before
testing and packing. Published metadata and `weather --version` report the
release version. CI does **not** commit version changes back to `main`; the
tracked source version can therefore lag the published patch number. Git tags,
GitHub Releases, and npm record the exact published versions and source commits.

## One-time npm setup

Before merging the workflow change, sign in as a package maintainer at
[weather-cli-16bit settings](https://www.npmjs.com/package/weather-cli-16bit/access)
and configure a **GitHub Actions trusted publisher**:

| Setting              | Value             |
| -------------------- | ----------------- |
| Organization or user | `jelrod27`        |
| Repository           | `weather-cli`     |
| Workflow filename    | `npm-publish.yml` |
| Environment          | Leave empty       |
| Allow npm publish    | Enabled           |

Enable **Allow npm publish** under **Allowed actions** before saving the
connection. Staged publishing alone does not authorize this workflow's direct
publishes. The separate **Allow npm dist-tag** permission is not required.

The workflow uses GitHub-hosted runners, Node 24 (npm >= 11.5.1),
`id-token: write`, and provenance. It needs no `NPM_TOKEN` secret. The package's
`repository.url` must match `https://github.com/jelrod27/weather-cli` (the current
`git+https://...git` form identifies that repository).

See the [official npm trusted publishing guide](https://docs.npmjs.com/trusted-publishers/).
Account setup is not verified by repository CI; an actual publish from `main`
is required to confirm the npm configuration.

## Retries and ordering

Release runs are serialized with `concurrency.queue: max`. GitHub retains up to
100 pending runs in this queue; excess runs are canceled and need their CI run
rerun when capacity is available.

If the npm publish job fails, choose **Re-run all jobs**. The publish step
requires validation outputs from the current run attempt; retrying only the
failed publish job is rejected before npm is invoked. This forces version and
ordering to be recalculated after any intervening release.

If npm succeeds but creating the GitHub Release fails, rerun **all jobs** of the
failed **NPM Publish** run. The source commit in npm metadata identifies the
existing version, avoids republishing it, and lets the GitHub Release be
created. Rerunning only the failed GitHub Release job also works.

If the release workflow never started, rerun the successful **push** CI run for
the relevant `main` commit. This emits the completion event again. A PR CI run
does not qualify, even if its PR has since merged.

If an older commit finishes CI after a newer release, it publishes under the
npm `historical` tag and is not marked as GitHub's latest release. Users of
`@latest` keep the newer code. Registry or Git ancestry errors fail the release
rather than guess a version or replace `latest` with an older build.

Dependency installation, tests, and packing happen without publish privileges.
The npm job publishes only the validated tarball with lifecycle scripts disabled;
a separate job creates the GitHub Release. Authentication errors require
checking the trusted publisher settings above.

## Verify a release

```bash
gh run list --repo jelrod27/weather-cli --workflow npm-publish.yml --limit 5
npm view weather-cli-16bit dist-tags --json
npm view weather-cli-16bit@latest version gitHead
npm install -g weather-cli-16bit@latest
weather --version
```

An installed CLI does not update itself when a package is published. Existing
users run the install command above to get the latest release.
