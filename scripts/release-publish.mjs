#!/usr/bin/env node
/**
 * Publish the publishable packages, in dependency order, under trusted
 * publishing.
 *
 * Two things stop this being `pnpm publish -r`:
 *
 *   - pnpm cannot speak OIDC (pnpm/pnpm#9812), so the publish itself has to be
 *     `npm publish`.
 *   - npm cannot read `workspace:^`, which is pnpm's protocol and what the
 *     manifests are written with. `pnpm publish` rewrites it on the way out;
 *     `npm publish` would ship the literal string.
 *
 * So the versions are written in first, and then each package is published
 * from its own directory - not as a packed tarball, because provenance is
 * documented for the directory form and only for that.
 *
 * The rewrite is destructive to the working tree, deliberately: this runs on
 * an ephemeral CI checkout, and refuses to run anywhere the tree is dirty
 * unless told otherwise.
 *
 * `--dry-run` is the exception, and has to be: a rehearsal that leaves the
 * manifests rewritten is a rehearsal that changes what it was rehearsing.
 * Worse, it leaves `workspace:^` replaced by a literal range in six files that
 * look plausible in a diff - so the next person to commit ships a set that no
 * longer links inside the workspace. So a dry run remembers what was there and
 * puts it back on the way out, whichever way it leaves.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgRoot = join(root, 'packages');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
// Asks the registry what a consumer can actually install, and publishes nothing.
const verify = args.includes('--verify');
let version = args.find((a) => !a.startsWith('--'));

// --- the registry ----------------------------------------------------------

const REGISTRY = process.env.RELEASE_REGISTRY ?? 'https://registry.npmjs.org';
/** How long to wait for npm to finish processing a publish it accepted. */
const PATIENCE_MS = Number(process.env.RELEASE_PATIENCE_MS ?? 5 * 60 * 1000);
const POLL_MS = 15_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The tarball a version resolves to, or null when the registry has no version. */
async function tarballFor(name, version) {
  const url = `${REGISTRY}/${name.replace('/', '%2F')}/${version}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const manifest = await res.json();
  return manifest?.dist?.tarball ?? null;
}

/**
 * Whether a version can actually be downloaded, which is not the same question
 * as whether the registry mentions it.
 *
 * npm answers for a version it is still processing: the manifest is there and
 * its tarball 404s. That is the state that let a release report "published 7 of
 * 7" with one package missing - the next run asked whether the version was on
 * the registry, was told yes, and skipped the one package that still needed
 * publishing. So the question asked here is for the bytes.
 */
async function isDownloadable(name, version) {
  const tarball = await tarballFor(name, version);
  if (!tarball) return false;
  const head = await fetch(tarball, { method: 'HEAD' });
  if (head.ok) return true;
  // A registry that will not answer HEAD still has to answer for one byte.
  const ranged = await fetch(tarball, { headers: { range: 'bytes=0-0' } });
  return ranged.ok || ranged.status === 206;
}

/** Which of these are not downloadable yet, giving npm up to PATIENCE_MS to catch up. */
async function waitForAll(pkgs, version) {
  const deadline = Date.now() + PATIENCE_MS;
  for (;;) {
    const missing = [];
    for (const p of pkgs)
      if (!(await isDownloadable(p.manifest.name, version))) missing.push(p.manifest.name);
    if (!missing.length || Date.now() >= deadline) return missing;
    console.log(`  not downloadable yet: ${missing.join(', ')} - npm may still be processing them`);
    await sleep(POLL_MS);
  }
}

// --- read the workspace ----------------------------------------------------

const packages = [];
for (const name of readdirSync(pkgRoot).sort()) {
  const dir = join(pkgRoot, name);
  const manifestPath = join(dir, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const original = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(original);
  if (manifest.private) continue;
  // The bytes as they were, not as they would be re-serialised: a rehearsal
  // that put back a *reformatted* file would still be a rehearsal that
  // changed the tree.
  packages.push({ dir, manifestPath, manifest, original, written: false });
}

const names = new Set(packages.map((p) => p.manifest.name));

if (!packages.length) {
  console.error('  no publishable packages found');
  process.exit(1);
}

// Given no version, take the set's own - it has to be unanimous either way,
// and a rehearsal should not need the number typed at it. CI passes the tag
// explicitly, so the tag and the manifests are still checked against a value
// that came from outside them.
version ??= packages[0].manifest.version;

// Every publishable package carries the version being released. A mixed set
// resolves to a combination nobody tested.
const wrong = packages.filter((p) => p.manifest.version !== version);
if (wrong.length) {
  for (const p of wrong)
    console.error(`  ${p.manifest.name} is ${p.manifest.version}, releasing ${version}`);
  process.exit(1);
}

// --- dependency order ------------------------------------------------------

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

const localDeps = (p) => {
  const out = new Set();
  for (const field of DEP_FIELDS)
    for (const dep of Object.keys(p.manifest[field] ?? {})) if (names.has(dep)) out.add(dep);
  return out;
};

const ordered = [];
const placed = new Set();
let remaining = [...packages];
while (remaining.length) {
  const ready = remaining.filter((p) => [...localDeps(p)].every((d) => placed.has(d)));
  if (!ready.length) {
    console.error(`  cycle among: ${remaining.map((p) => p.manifest.name).join(', ')}`);
    process.exit(1);
  }
  // Sorted so the order is the same on every run, not just a valid one.
  ready.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  for (const p of ready) {
    ordered.push(p);
    placed.add(p.manifest.name);
  }
  remaining = remaining.filter((p) => !placed.has(p.manifest.name));
}

// --- verify, if that is all that was asked for -----------------------------

if (verify) {
  const missing = await waitForAll(ordered, version);
  for (const p of ordered)
    console.log(`  ${missing.includes(p.manifest.name) ? 'missing' : 'up     '}  ${p.manifest.name}`);
  if (missing.length) {
    console.error(`\n  ${missing.join(', ')} cannot be downloaded at ${version}`);
    process.exit(1);
  }
  console.log(`\nall ${ordered.length} downloadable at ${version}`);
  process.exit(0);
}

// --- write the versions in -------------------------------------------------

if (!force && !dryRun) {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (dirty.trim()) {
    console.error('  the tree is dirty; this rewrites manifests in place. --force to override.');
    process.exit(1);
  }
}

for (const p of ordered) {
  let touched = false;
  for (const field of DEP_FIELDS) {
    const deps = p.manifest[field];
    if (!deps) continue;
    for (const [dep, range] of Object.entries(deps)) {
      if (!names.has(dep) || !range.startsWith('workspace:')) continue;
      // `workspace:^` and `workspace:*` both mean "this version"; a literal
      // range after the colon is kept as written.
      const suffix = range.slice('workspace:'.length);
      deps[dep] = suffix === '^' || suffix === '*' || suffix === '' ? `^${version}` : suffix;
      touched = true;
    }
  }
  if (touched) {
    writeFileSync(p.manifestPath, JSON.stringify(p.manifest, null, 2) + '\n');
    p.written = true;
  }
}

// Registered rather than called: the checks below exit on failure, and a
// rehearsal that restored only on success would leave the tree rewritten in
// exactly the case somebody is most likely to walk away from.
if (dryRun) {
  process.on('exit', () => {
    for (const p of ordered) if (p.written) writeFileSync(p.manifestPath, p.original);
  });
}

// Nothing may reach the registry still speaking pnpm.
const leftover = [];
for (const p of ordered)
  for (const field of DEP_FIELDS)
    for (const [dep, range] of Object.entries(p.manifest[field] ?? {}))
      if (String(range).startsWith('workspace:')) leftover.push(`${p.manifest.name} -> ${dep}@${range}`);
if (leftover.length) {
  for (const l of leftover) console.error(`  unresolved workspace dependency: ${l}`);
  process.exit(1);
}

// --- publish ---------------------------------------------------------------

console.log(`${ordered.length} packages at ${version}, in order:`);
for (const p of ordered) console.log(`  ${p.manifest.name}`);

if (dryRun) {
  console.log('\n--dry-run: the rewrite works, nothing published, manifests put back');
  process.exit(0);
}

/**
 * A package that is already up is left alone.
 *
 * A package new to the set is bootstrapped by hand at the release version
 * (RELEASING.md), and a set that failed halfway has its first packages up
 * already; npm refuses to publish over either, and the refusal would stop the
 * packages after it.
 *
 * "Up" means downloadable, not mentioned: see `isDownloadable`. A version npm
 * is still processing is one this run still has to publish.
 */
let published = 0;
for (const p of ordered) {
  if (await isDownloadable(p.manifest.name, version)) {
    console.log(`\n${p.manifest.name}@${version} is on the registry already: skipped`);
    continue;
  }
  console.log(`\npublishing ${p.manifest.name}@${version}`);
  // Under trusted publishing the OIDC exchange is npm's own; there is no
  // token here and provenance is attached without asking for it.
  execFileSync('npm', ['publish', '--access', 'public'], { cwd: p.dir, stdio: 'inherit' });
  published += 1;
}

console.log(`\npublished ${published} of ${ordered.length} packages at ${version}`);

// A publish npm accepted is not a publish a consumer can install. Stopping at
// "npm publish exited 0" is how one package of a set went missing with the run
// reported green, so the last thing a release does is install the set from the
// registry - in the only way that needs no credentials, by asking for the bytes.
const missing = await waitForAll(ordered, version);
if (missing.length) {
  console.error(`\n  ${missing.join(', ')} answer for ${version} but cannot be downloaded`);
  console.error('  Re-run this workflow once npm has caught up: the rest are skipped.');
  process.exit(1);
}
console.log(`all ${ordered.length} downloadable at ${version}`);
