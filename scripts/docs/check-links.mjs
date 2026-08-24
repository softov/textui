// Every relative link in the docs and in the READMEs must resolve to a file
// that exists.
//
// jekyll-relative-links rewrites `.md` targets at build time, so a broken one
// is not a build error - it is a 404 on the published site and a dead link on
// github.com. Cheap to check, and the only thing that catches a rename.
//
// The READMEs are here because they were the ones that rotted. They link *into*
// docs and into source, so a page renamed to `README.md` or a file moved to
// another package breaks them, and checking only `docs/` never saw it. They are
// also what npm renders, which makes a dead link there the first thing a
// stranger meets.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { ROOT, at } from './root.mjs';

const DOCS = at('docs');
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (e.startsWith('_') || e.startsWith('.') || e === 'snippets' || e === 'vendor') continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (e.endsWith('.md')) files.push(full);
  }
})(DOCS);

for (const extra of [
  'README.md', 'CLAUDE.md',
  ...['packages', 'examples'].flatMap((group) =>
    readdirSync(at(group)).map((name) => join(group, name, 'README.md'))),
  'components/README.md', 'playground/README.md',
]) {
  const full = at(extra);
  if (existsSync(full) && statSync(full).isFile()) files.push(full);
}

const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
let broken = 0;
let checked = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(LINK)) {
    const raw = m[1];
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    const target = raw.split('#')[0];
    if (!target) continue;
    checked++;
    const abs = resolve(dirname(file), target);
    // Inside `docs`, a directory link is served by its README.md and is a 404
    // without one. Outside it, github renders the folder, so existing is
    // enough - a README pointing at `components/` means the folder.
    const servedByJekyll = !relative(DOCS, file).startsWith('..');
    const ok = existsSync(abs)
      && (statSync(abs).isFile() || !servedByJekyll || existsSync(join(abs, 'README.md')));
    if (!ok) {
      broken++;
      console.error(`${relative(ROOT, file)}  ->  ${raw}`);
    }
  }
}

console.log(`${checked} links checked, ${broken} broken`);
process.exit(broken ? 1 : 0);
