# Automatic npm releases

Every merge to `main` whose push CI succeeds should publish an npm package
and a matching GitHub Release. Justin chose automatic publishing over a
separate release PR and delegated the version strategy.

## Approaches

- Publishing only GitHub Releases leaves merges unpublished (the current gap).
- A generated release PR batches updates but adds an approval step Justin declined.
- Publish after successful push CI on `main`, with automatic patch versions.
  This is the selected approach; no project dependencies are added.

## Design

The existing CI remains the gate, including all Node versions, formatting,
coverage, and secret scanning. Only successful push runs from this repository's
`main` qualify. Queue release runs without canceling pending releases.

Choose the next unused stable patch version above npm versions and Git tags,
using the tracked `package.json` version as a minimum. The first release is
`0.5.1`; a deliberate higher minor or major version starts that line. Update
package and lockfile versions only in the build checkout; never commit to `main`.
Published packages include their source commit. A retry reuses an already
published version for that commit and repairs a missing GitHub Release.

An older commit finishing CI after a newer published commit uses the npm
`historical` tag and does not replace npm `latest` or GitHub's latest release.
Registry or ancestry errors stop the release rather than guess a version.

Build and test without publishing permissions. Publish the validated tarball
in a separate job with OIDC, Node 24, and no dependency/lifecycle execution.
Create the GitHub Release separately with contents write permission.

Configuring the npm trusted publisher is a documented manual prerequisite;
this task does not change npm account authentication settings or publish a
package before Justin reviews the PR.
