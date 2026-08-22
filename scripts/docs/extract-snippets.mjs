// Lift every ```tsx block out of the docs into a compilable module.
//
// The markdown is the source of truth - a reader sees the whole example
// inline, imports included, rather than a fragment that only compiles with a
// preamble they cannot see. This turns each block back into a file so `tsc`
// can have an opinion about it.
//
// A block that is deliberately partial - a prop shape, a fragment quoted
// mid-sentence - opts out with `<!-- docs:nocheck -->` on the line before it.
//
// An example that reads better without its scaffolding puts the scaffolding in
// a `<!-- docs:setup ... -->` comment, which is prepended to every snippet on
// the page and never rendered. That is what keeps `<Button onPress={save} />`
// in the prose instead of twelve lines of imports declaring what `save` is.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const DOCS = resolve('docs');
const OUT = resolve('scripts/docs/snippets/src');

function markdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const FENCE = /^([ \t]*)```(tsx|ts)\s*$/;
const SETUP = /<!--\s*docs:setup\s*([\s\S]*?)-->/g;
// `docs:local` applies to the next block only, for a page where one snippet
// defines what a later one uses - a page-wide declare would collide with the
// definition rather than stand in for it.
const LOCAL = /<!--\s*docs:local\s*([\s\S]*?)-->/;
let written = 0;
let skipped = 0;

for (const file of markdownFiles(DOCS)) {
  const text = readFileSync(file, 'utf8');
  const setup = [...text.matchAll(SETUP)].map((m) => m[1].trim()).join('\n');
  const lines = text.split('\n');
  const slug = relative(DOCS, file).replace(/\.md$/, '').replace(/[/.]/g, '-');
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE);
    if (!open) continue;

    const indent = open[1];
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === '```') break;
      body.push(lines[j].startsWith(indent) ? lines[j].slice(indent.length) : lines[j]);
    }

    const startLine = i + 1;
    i = j;
    index++;

    // Markers on the nearest non-blank line (or comment block) above.
    let k = startLine - 2;
    while (k >= 0 && lines[k].trim() === '') k--;
    if (k >= 0 && lines[k].includes('docs:nocheck')) { skipped++; continue; }

    let local = '';
    if (k >= 0 && lines[k].includes('-->')) {
      let start = k;
      while (start >= 0 && !lines[start].includes('<!--')) start--;
      if (start >= 0) {
        const m = lines.slice(start, k + 1).join('\n').match(LOCAL);
        if (m) local = m[1].trim();
      }
    }

    const header =
      `// Extracted from ${relative(resolve('.'), file)}:${startLine}\n` +
      `// Edit the markdown, not this file.\n` +
      (setup ? `${setup}\n` : '') +
      (local ? `${local}\n` : '');
    writeFileSync(join(OUT, `${slug}-${index}.tsx`), header + body.join('\n') + '\n');
    written++;
  }
}

console.log(`snippets: ${written} checked, ${skipped} opted out`);
