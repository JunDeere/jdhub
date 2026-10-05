# 13 - Versioning and Releases

## Current Version

JDHub's current development version is `0.2.0-beta.1`.

The repository did not previously have Git release tags, and its frontend and
backend manifests used conflicting placeholder versions. Version
`0.2.0-beta.1` establishes one shared product version while MVP 2 is still being
finished and reviewed.

## Version Format

JDHub uses Semantic Versioning:

```text
MAJOR.MINOR.PATCH[-PRERELEASE]
```

- `MAJOR`: incompatible changes after the product reaches a stable `1.0.0`.
- `MINOR`: a meaningful backward-compatible capability or product milestone.
- `PATCH`: backward-compatible fixes and small refinements.
- `beta.N`: a testable pre-release that still needs final production review.

JDHub remains in the `0.x` phase while its APIs, permissions, and module design
are still evolving. Breaking changes may therefore occur between minor releases
and must be explained in the changelog.

## Sources of Version Information

The same product version must be kept in:

- `/VERSION` - human- and automation-readable product version.
- `/backend/package.json` and `/backend/package-lock.json`.
- `/frontend/package.json` and `/frontend/package-lock.json`.
- `/CHANGELOG.md` - user-facing release history.

The root `VERSION` file is the canonical value. Frontend and backend package
versions describe JDHub as a product, not independently published npm packages.

## Release Process

Do not bump the version for every local edit. Bump it when preparing a coherent
checkpoint or release.

1. Decide whether the change is a prerelease, patch, minor, or major update.
2. Update the four manifest/lockfile version fields and `/VERSION` together.
3. Move completed notes from `Unreleased` into the new changelog section.
4. Update the README, roadmap, developer journal, and environment examples when
   behavior or setup changed.
5. Run backend tests, frontend lint, frontend build, Compose validation, and a
   staged secret/unrelated-file review.
6. Commit the reviewed release contents.
7. Only after the commit is approved, create an annotated Git tag such as
   `v0.2.0-beta.1` and push both the commit and tag.

Creating a version file or changing package metadata does not authorize a Git
commit, tag, push, or server deployment.

## Recommended Next Versions

- `0.2.0-beta.2`: another reviewed MVP 2 prerelease with meaningful fixes.
- `0.2.0`: MVP 2 is documented, verified, and considered ready for regular use.
- `0.2.1`: backward-compatible fixes after `0.2.0`.
- `0.3.0`: the next substantial capability milestone.
- `1.0.0`: stable interfaces, permissions, backup/recovery, and production
  operations are documented and dependable.
