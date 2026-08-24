# Changelog

The publishable packages release as a set, under one version. `workspace:^`
between them means a mixed set resolves to a combination nobody tested, so the
tag is the version and every package carries it.

This file records the set. Anything package-specific says which package.

## Unreleased

Publishing moved to npm trusted publishing: GitHub Actions exchanges an OIDC
token for a short-lived credential, and there is no `NPM_TOKEN` in the
repository any more.

Two things made that more than a flag. Trusted publishing cannot *create* a
package - npm only attaches a trusted publisher to a name that already exists,
so 0.1.0 still had to be bootstrapped with a token, which was then deleted.
And `pnpm publish` has no OIDC support, while `npm publish` cannot read
`workspace:^`; `scripts/release-publish.mjs` resolves the ranges and publishes
each package from its own directory in dependency order.

### The facade is `@textui/kit`, not `textui`

npm refused the unscoped name: "Package name too similar to existing package
`text-ui`". That package is a tombstone - zero versions, no maintainers,
nothing published since 2022 - but npm reserves the names of unpublished
packages permanently, and the reserved name still trips the similarity check.

The bare name is not taken, only blocked, so it may become available if npm
lifts the check. Until then the one-install entry point is `@textui/kit`. The
`textui` *command* is unaffected: it is the bin of `@textui/cli`, and a bin
name is not a package name.

### 0.1.0 - the first publish

Six packages: [`@textui/kit`](packages/facade), [`@textui/core`](packages/core),
[`@textui/widgets`](packages/widgets), [`@textui/terminal`](packages/terminal),
[`@textui/testing`](packages/testing) and [`@textui/cli`](packages/cli).

`@textui/documents`, `@textui/textide` and `@textui/textide-git` are in the
repository and build in CI, but are held back from this release - they are
marked `private` until their surface settles, so `pnpm publish -r` skips them.

Pre-1.0: the surface is still moving.

#### Fixed before publishing

- `@textui/core` declared an `./hooks` export subpath pointing at
  `dist/hooks/`, which is never emitted - hooks live in `runtime/hooks.ts` and
  are already re-exported from the root. Nothing in the repository imported the
  subpath, so nothing caught it; it would have been `ERR_MODULE_NOT_FOUND` for
  the first consumer who tried it. The subpath is gone, and
  `scripts/check-exports.mjs` now runs in CI so the next one fails a PR.
- Every package ships the MIT `LICENSE` in its tarball. `license: "MIT"` in the
  manifest is not the licence text, and npm only includes a `LICENSE` that sits
  in the package's own directory.
- Package READMEs linked to sibling packages relatively (`../core`), which
  resolves in the repository and 404s on npmjs.com. They are absolute now.
- The documents guide said the JSON adapter ships in `@textui/core/adapters`.
  It ships in `@textui/documents`; `core/src/adapters` is a deliberately empty
  placeholder, and says so.
