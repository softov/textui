// Every relative link in the docs must resolve to a file that exists.
//
// jekyll-relative-links rewrites `.md` targets at build time, so a broken one
// is not a build error - it is a 404 on the published site and a dead link on
// github.com. Cheap to check, and the only thing that catches a rename.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const DOCS = resolve('docs');
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (e.startsWith('_') || e.startsWith('.') || e === 'snippets' || e === 'vendor') continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (e.endsWith('.md')) files.push(full);
  }
})(DOCS);

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
    // A directory link is served by its README.md.
    const ok = existsSync(abs) && (statSync(abs).isFile() || existsSync(join(abs, 'README.md')));
    if (!ok) {
      broken++;
      console.error(`${relative(resolve('.'), file)}  ->  ${raw}`);
    }
  }
}

console.log(`${checked} links checked, ${broken} broken`);
process.exit(broken ? 1 : 0);
