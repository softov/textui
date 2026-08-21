#!/usr/bin/env node
/**
 * Checks the docs tree against what just-the-docs actually requires, without
 * needing Ruby.
 *
 * The failure this exists for: just-the-docs matches a child to its section by
 * title *string*, not by path. A typo in `parent:` does not error - the page
 * silently vanishes from the sidebar, and nothing in a Jekyll build says so.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'docs');

// The same set `exclude:` in _config.yml keeps out of the build. `vendor/` is
// where the container installs gems, and it is full of other people's READMEs.
const SKIP = new Set(['vendor', '_site', 'node_modules']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_') || entry.startsWith('.') || SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Front matter only - enough of YAML for the five keys these pages use. */
function parse(file) {
  const text = readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return { file, text, front: null };
  const front = {};
  for (const line of match[1].split('\n')) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) front[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { file, text, front, body: text.slice(match[0].length) };
}

const pages = walk(root).map(parse);
const errors = [];
const warnings = [];
const rel = (f) => relative(root, f);

// 1. Front matter, with a title.
for (const p of pages) {
  if (!p.front) { errors.push(`${rel(p.file)}: no front matter - Jekyll will copy it verbatim, not render it`); continue; }
  if (!p.front.title) errors.push(`${rel(p.file)}: no title`);
  if (!p.front.nav_order) warnings.push(`${rel(p.file)}: no nav_order - it will sort alphabetically`);
}

// 2. Titles unique site-wide.
const byTitle = new Map();
for (const p of pages) {
  if (!p.front?.title) continue;
  if (byTitle.has(p.front.title)) {
    errors.push(`duplicate title ${JSON.stringify(p.front.title)}: ${rel(byTitle.get(p.front.title).file)} and ${rel(p.file)}`);
  } else byTitle.set(p.front.title, p);
}

// 3. Every parent names a real section.
for (const p of pages) {
  const parent = p.front?.parent;
  if (!parent) continue;
  const target = byTitle.get(parent);
  if (!target) errors.push(`${rel(p.file)}: parent ${JSON.stringify(parent)} matches no page title - this page will not appear in the sidebar`);
  else if (target.front.has_children !== 'true') errors.push(`${rel(p.file)}: parent ${JSON.stringify(parent)} (${rel(target.file)}) is missing has_children: true`);
}

// 4. Sections are not empty, and top-level pages are intentional.
for (const p of pages) {
  if (p.front?.has_children !== 'true') continue;
  const kids = pages.filter((q) => q.front?.parent === p.front.title);
  if (kids.length === 0) errors.push(`${rel(p.file)}: has_children but nothing names it as parent`);
  const orders = kids.map((k) => k.front.nav_order);
  const dupes = orders.filter((o, i) => o && orders.indexOf(o) !== i);
  if (dupes.length) warnings.push(`${rel(p.file)}: duplicate nav_order among children: ${[...new Set(dupes)].join(', ')}`);
}

// 5. Relative .md links resolve. jekyll-relative-links rewrites these; a link
//    to a file that is not there is simply left as a dead `.md` URL.
for (const p of pages) {
  for (const m of p.text.matchAll(/\[[^\]]*\]\(([^)]+\.md[^)]*)\)/g)) {
    const target = m[1].split('#')[0];
    if (/^[a-z]+:\/\//.test(target)) continue;
    try { statSync(resolve(dirname(p.file), target)); }
    catch { errors.push(`${rel(p.file)}: broken link -> ${target}`); }
  }
}

// 6. The body H1 should match the sidebar title; the layout renders no title of
//    its own, so a mismatch shows two different names for one page.
for (const p of pages) {
  if (!p.front?.title || !p.body) continue;
  // The site root is "Home" in the sidebar and the project's name as a heading.
  if (rel(p.file) === 'index.md') continue;
  const h1 = /^#\s+(.+)$/m.exec(p.body);
  if (!h1) warnings.push(`${rel(p.file)}: no H1 - the page renders headless`);
  else if (h1[1].trim() !== p.front.title.trim()) warnings.push(`${rel(p.file)}: H1 ${JSON.stringify(h1[1].trim())} != title ${JSON.stringify(p.front.title)}`);
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

const sections = pages.filter((p) => p.front?.has_children === 'true').length;
console.log(`\n${pages.length} pages, ${sections} sections, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
