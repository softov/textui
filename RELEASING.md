# Releasing

The publishable packages release as a set, under one version. They depend on each other with `workspace:^`, so a mixed set resolves to a combination nobody tested. The tag is the version; every publishable package carries it.

Publishing is done by GitHub Actions through **trusted publishing** - npm exchanges the workflow's OIDC token for a short-lived credential. There is no `NPM_TOKEN`, and there should never be one again.

## What publishes

Six, in dependency order - `scripts/release-publish.mjs` works this out itself:

```
@textui/core
  -> @textui/terminal -> @textui/widgets
       -> @textui/cli, @textui/testing, @textui/kit
```

`@textui/documents`, `@textui/textide` and `@textui/textide-git` are marked `private` in their manifests. That is what holds them back, and it is the only thing that does - a filter you have to remember is a filter that gets forgotten. Remove `private` when their surface settles and they join the set.

## Why not `pnpm publish -r`

It would be the obvious command, and it does the two things that matter - dependency order, and rewriting `workspace:^` into a real range. It cannot do the third: pnpm has no OIDC support ([pnpm#9812][pnpm-oidc]), so a trusted publish through it fails to authenticate.

`npm publish` speaks OIDC and cannot read `workspace:^`, which is pnpm's protocol. So `scripts/release-publish.mjs` writes the versions in first, then publishes each package from its own directory with `npm publish`. Not as a packed tarball: provenance is documented for the directory form and only for that, and a release is a bad place to find out which forms were untested.

[pnpm-oidc]: https://github.com/pnpm/pnpm/issues/9812

## Once, before the first publish

Trusted publishing **cannot create a package**. npm will only attach a trusted publisher to a name that already exists on the registry, and `npm trust` says so in its own prerequisites - unlike PyPI, there is no pre-registration ([npm/cli#8544][npm-bootstrap]). So the first release of a new package needs a credential, and every release after it does not.

That bootstrap is done once per package, and the six in this repository have already been through it. If you add a package to the set later, it needs the same - and check the name is publishable *before* writing anything against it:

```bash
npm view <name>          # free is a 404
```

A 404 is necessary and not sufficient. npm also refuses a name that is merely *similar* to an existing one, including a name whose every version was unpublished and which therefore has nothing behind it. That is what stopped this project publishing as bare `textui` - `text-ui` is an empty tombstone from 2022 and the similarity check still counts it. The refusal arrives as a 403 at publish time, after the gate has run, so it is worth a minute up front.

Scoped names are exempt from that check, which is why `@textui/kit` published without argument.

1. Publish it once with an npm **automation** token - not a classic publish token, which prompts for a one-time password and fails in CI with `EOTP`, and not a granular token restricted to specific packages, which cannot create a package that does not exist yet.
2. Configure trusted publishing on it:

   ```bash
   npm trust github @textui/<name> --file release.yml
   ```

   Needs npm >= 11.15.0 and 2FA on the account. A five-minute 2FA window makes doing all of them in one sitting practical.
3. Delete the token.

[npm-bootstrap]: https://github.com/npm/cli/issues/8544

## The `registry-url` trap

`actions/setup-node` writes `_authToken=${NODE_AUTH_TOKEN}` into an `.npmrc` whenever it is given a `registry-url`. With no token to substitute, that line becomes an *empty credential* rather than no credential - and npm reads any `_authToken` line as "auth is configured", so it never performs the OIDC exchange and fails as `ENEEDAUTH` or a 404 ([setup-node#1551][sn1551]).

The failure looks like a permissions problem and is not one, which is why `release.yml` sets no `registry-url` and `scripts/check-no-npm-auth.mjs` runs before the publish. npmjs.org is the default registry regardless.

[sn1551]: https://github.com/actions/setup-node/issues/1551

## Cutting one

1. Land everything. `main` green.
2. Set the version on the six publishable manifests, and move the `## Unreleased` heading in [`CHANGELOG.md`](CHANGELOG.md) down to the new version.
3. `pnpm check:version <version>` - it fails if any of the six disagrees.
4. Tag and push:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

The workflow runs the same gate CI runs - build, typecheck, lint, test - plus `check:exports` and the tag/version check, and only then publishes.

## Rehearsing one

`workflow_dispatch` with `dry_run` on, which is the default: the whole gate, the manifest rewrite, the dependency order printed, and nothing published.

Locally:

```bash
pnpm build && pnpm check:exports              # what a consumer will resolve
node scripts/release-publish.mjs 0.1.0 --dry-run   # order and version rewrite
git checkout -- packages/                     # the dry run rewrites manifests
```

The dry run edits manifests in place and does not put them back - outside CI, check out `packages/` afterwards. It refuses to run against a dirty tree unless given `--force`.

## What the guards are for

- **`scripts/check-exports.mjs`** - every `exports` and `bin` target exists in the built tree and is covered by `files[]`, and every package has a README and a LICENSE. tsc cannot catch a subpath nothing in the repository imports; `@textui/core` shipped a broken `./hooks` for exactly that reason. Runs in CI on every pull request.
- **`scripts/check-version.mjs`** - the tag and the manifests agree. Runs in the release workflow, on tag only.
- **`scripts/release-publish.mjs`** - refuses a set at mixed versions, refuses a dependency cycle, and refuses to publish anything still carrying a `workspace:` range.
- **`scripts/check-no-npm-auth.mjs`** - refuses to publish while any npm credential is configured, because a credential is what stops the OIDC exchange happening at all. Runs in the release workflow, before the publish.
