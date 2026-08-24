# Releasing

The publishable packages release as a set, under one version. They depend on
each other with `workspace:^`, so a mixed set resolves to a combination nobody
tested. The tag is the version; every publishable package carries it.

## What publishes

Six, in dependency order - `pnpm publish -r` works this out itself:

```
@textui/core
  -> @textui/widgets, @textui/terminal
       -> textui, @textui/testing, @textui/cli
```

`@textui/documents`, `@textui/textide` and `@textui/textide-git` are marked
`private` in their manifests. That is what holds them back, and it is the only
thing that does - a filter you have to remember is a filter that gets
forgotten. Remove `private` when their surface settles and they join the set.

## Once, before the first publish

The `@textui` scope is reserved. What is still needed:

- An npm **automation** token with publish rights on the `@textui` scope and on
  the unscoped `textui` name, stored as the `NPM_TOKEN` repository secret:

  ```bash
  gh secret set NPM_TOKEN        # paste the token when prompted
  ```

  It has to be an automation token, not a classic one - a token with 2FA on
  publish cannot be used unattended, and the workflow has no way to answer the
  prompt.

- The unscoped `textui` name confirmed as yours. The scope covers `@textui/*`
  but not the facade package, which publishes as bare `textui`.

Nothing else is required: provenance is signed with the workflow's `id-token`
permission, which is already granted in `release.yml`.

## Cutting one

1. Land everything. `main` green.
2. Set the version on the six publishable manifests, and move the
   `## Unreleased` heading in [`CHANGELOG.md`](CHANGELOG.md) down to the new
   version.
3. `pnpm check:version <version>` - it fails if any of the six disagrees.
4. Tag and push:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

The `Release` workflow runs the same gate CI runs - build, typecheck, lint,
test - plus `check:exports` and the tag/version check, packs every package, and
only then publishes with provenance.

## Rehearsing one

The workflow takes a manual `workflow_dispatch` with `dry_run` on by default:
it runs the whole gate and packs every tarball, and publishes nothing. Use it
before the first real tag.

Locally:

```bash
pnpm build && pnpm check:exports     # what a consumer will actually resolve
pnpm -r exec npm pack --dry-run      # what is in each tarball
```

## What the guards are for

- **`scripts/check-exports.mjs`** - every `exports` and `bin` target exists in
  the built tree and is covered by `files[]`, and every package has a README
  and a LICENSE. tsc cannot catch a subpath nothing in the repository imports;
  `@textui/core` shipped a broken `./hooks` for exactly that reason. Runs in
  CI on every pull request.
- **`scripts/check-version.mjs`** - the tag and the manifests agree. Runs in
  the release workflow, on tag only.
