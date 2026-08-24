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
let version = args.find((a) => !a.startsWith('--'));

// --- read the workspace ----------------------------------------------------

const packages = [];
for (const name of readdirSync(pkgRoot).sort()) {
  const dir = join(pkgRoot, name);
  const manifestPath = join(dir, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.private) continue;
  packages.push({ dir, manifestPath, manifest });
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
  if (touched) writeFileSync(p.manifestPath, JSON.stringify(p.manifest, null, 2) + '\n');
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
  console.log('\n--dry-run: manifests rewritten, nothing published');
  process.exit(0);
}

for (const p of ordered) {
  console.log(`\npublishing ${p.manifest.name}@${version}`);
  // Under trusted publishing the OIDC exchange is npm's own; there is no
  // token here and provenance is attached without asking for it.
  execFileSync('npm', ['publish', '--access', 'public'], { cwd: p.dir, stdio: 'inherit' });
}

console.log(`\npublished ${ordered.length} packages at ${version}`);
