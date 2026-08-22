// Scaffold one page per component, and keep every prop table honest.
//
// Two jobs, deliberately split:
//
//   * a page is written once, and after that it belongs to whoever edits it.
//     Prose about why a component behaves the way it does is the point of
//     these docs and a generator has nothing to say about it;
//   * the prop table between the `props` markers is rewritten every run, from
//     the interface itself. That is the part that rots, so that is the part
//     nobody types by hand.
//
// Run with --check to fail instead of write, which is what CI wants.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { EXAMPLES } from './examples.mjs';
import { join, relative } from 'node:path';
import { ROOT, at } from './root.mjs';

const CHECK = process.argv.includes('--check');

// The catalog is read from `dist`, because it is a runtime value rather than
// something a parser can recover from the source. That makes a stale build
// look exactly like a component that does not exist - silently documenting 91
// of 94 is the failure this guards against.
//
// The check is semantic rather than a timestamp comparison: `tsc -b` correctly
// skips a file that was touched but not changed, so mtime reports stale builds
// that are not stale. Comparing the names instead only fires when a component
// really is missing from the build.
/**
 * Registered by the app itself rather than by `registerBuiltins`, so absent
 * from CATALOG on purpose. `Screen` is the screen router's own frame - see
 * app.ts, which registers SCREEN_COMPONENTS beside PRIMITIVES at construction.
 */
const NOT_IN_CATALOG = new Set(['Screen']);

function declaredInSource() {
  const names = new Set();
  for (const pkg of ['core', 'documents']) {
    const dir = at(`packages/${pkg}/src`);
    for (const f of readdirSync(dir, { recursive: true })) {
      if (!String(f).endsWith('.ts')) continue;
      const text = readFileSync(join(dir, String(f)), 'utf8');
      for (const m of text.matchAll(/^\s*component:\s*'([A-Za-z][\w]*)'/gm)) names.add(m[1]);
    }
  }
  return names;
}

const core = await import('../../packages/core/dist/ui/index.js');
const docs = await import('../../packages/documents/dist/index.js');
const { interfaces, byFile, components, aliases } = JSON.parse(
  readFileSync(at('scripts/docs/props.json'), 'utf8'),
);

const CATALOG = [
  ...core.CATALOG,
  ...docs.RESOURCE_COMPONENTS.map((c) => ({ ...c, pkg: '@textui/documents' })),
  ...docs.JSON_COMPONENTS.map((c) => ({ ...c, pkg: '@textui/documents' })),
  ...docs.EDITOR_COMPONENTS.map((c) => ({ ...c, pkg: '@textui/documents' })),
];

{
  const built = new Set(CATALOG.map((c) => c.component));
  const missing = [...declaredInSource()].filter((n) => !built.has(n) && !NOT_IN_CATALOG.has(n));
  if (missing.length) {
    console.error(
      `Declared in source but absent from the build: ${missing.join(', ')}\n` +
      `The catalog comes from dist/. Run: pnpm build`,
    );
    process.exit(1);
  }
}

/**
 * Which level-2 page each component hangs under.
 *
 * These are the five pages that already exist, prose and all, plus one new one
 * for the primitives. The registry's own `category` is finer than this and is
 * not used directly: it groups for a component palette, which is a different
 * job from helping a reader find a page. Where the two disagree, the existing
 * prose wins - `navigation.md` has documented StatusBar, Toolbar and KeyHints
 * under "Navigation and chrome" since before any of this.
 */
const SECTIONS = {
  layout:     { dir: 'layout',     title: 'Layout and overflow' },
  display:    { dir: 'display',    title: 'Display and data' },
  data:       { dir: 'display',    title: 'Display and data' },
  chart:      { dir: 'display',    title: 'Display and data' },
  feedback:   { dir: 'display',    title: 'Display and data' },
  control:    { dir: 'input',      title: 'Controls and forms' },
  form:       { dir: 'input',      title: 'Controls and forms' },
  navigation: { dir: 'navigation', title: 'Navigation and overlays' },
  overlay:    { dir: 'navigation', title: 'Navigation and overlays' },
  chrome:     { dir: 'surfaces',   title: 'Surfaces, shells and resources' },
  resource:   { dir: 'surfaces',   title: 'Surfaces, shells and resources' },
  editor:     { dir: 'surfaces',   title: 'Surfaces, shells and resources' },
  json:       { dir: 'surfaces',   title: 'Surfaces, shells and resources' },
};

/** Components the registry files one way and the docs file another. */
const OVERRIDES = {
  StatusBar: 'navigation', Toolbar: 'navigation', KeyHints: 'navigation',
};

/** Ordered groups for the catalog table, and which categories feed each. */
const CATALOG_GROUPS = [
  ['The four primitives', (c) => PRIMITIVES.has(c.component)],
  ['Layout', (c) => c.category === 'layout'],
  ['Display', (c) => c.category === 'display'],
  ['Data', (c) => c.category === 'data'],
  ['Charts', (c) => c.category === 'chart'],
  ['Feedback and status', (c) => c.category === 'feedback'],
  ['Controls', (c) => c.category === 'control'],
  ['Forms', (c) => c.category === 'form'],
  ['Navigation', (c) => c.category === 'navigation' || OVERRIDES[c.component] === 'navigation'],
  ['Overlays', (c) => c.category === 'overlay'],
  ['Surfaces and shells', (c) => c.category === 'chrome' && !OVERRIDES[c.component]],
  ['Resources and documents', (c) => ['resource', 'editor', 'json'].includes(c.category)],
];

const PRIMITIVES = new Set(['box', 'text', 'canvas', 'spacer']);

// `<spacer>` the primitive and `<Spacer>` the component are different things
// that differ only in case, and a case-insensitive filesystem would collapse
// them. They also read better together than filed under two categories.
const PRIMITIVE_SECTION = { dir: 'primitives', title: 'The four primitives' };

/** Inline a type alias when it is a plain union, so the table says what to pass. */
function renderType(type) {
  let out = type;
  for (const [name, value] of Object.entries(aliases)) {
    if (!new RegExp(`\\b${name}\\b`).test(out)) continue;
    const union = value.replace(/^\|\s*/, '').trim();
    if (!union.includes("'") || union.length > 110) continue;
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), union);
  }
  return out.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

/** Walk the extends chain, stopping at the shared bases documented elsewhere. */
const SHARED = new Set(['BoxProps', 'TextProps', 'BaseProps', 'CanvasProps', 'SpacerProps']);

/** Prefer an interface from the component's own file - see the SpacerProps pair. */
function lookup(name, file) {
  return (file && byFile[file]?.[name]) ?? interfaces[name];
}

function ownProps(propsType, file) {
  const seen = [];
  const visit = (name) => {
    const iface = lookup(name, file);
    if (!iface) return;
    for (const m of iface.members) if (!seen.some((s) => s.name === m.name)) seen.push(m);
    for (const base of iface.extends) {
      const bare = base.replace(/<.*/, '').replace(/^Omit<\s*/, '').split(',')[0].trim();
      if (!SHARED.has(bare)) visit(bare);
    }
  };
  visit(propsType);
  return seen;
}

function baseOf(propsType, file) {
  const iface = lookup(propsType, file);
  if (!iface) return null;
  for (const base of iface.extends) {
    const m = base.match(/\b(BoxProps|TextProps|BaseProps)\b/);
    if (m) return m[1];
  }
  return null;
}

function propsTable(entry) {
  const propsType = components[entry.component]?.propsType
    ?? (PRIMITIVES.has(entry.component)
      ? `${entry.component[0].toUpperCase()}${entry.component.slice(1)}Props`
      : null);

  const file = components[entry.component]?.file;
  if (!propsType || !lookup(propsType, file)) {
    return '_No props of its own._\n';
  }

  const defaults = components[entry.component]?.defaults ?? {};
  const rows = ownProps(propsType, file);
  const base = baseOf(propsType, file);

  let out = '';
  if (rows.length === 0) {
    out += `\`${propsType}\` adds nothing of its own.\n`;
  } else {
    out += '| Prop | Type | Default | |\n| --- | --- | --- | --- |\n';
    for (const p of rows) {
      const def = defaults[p.name] ? `\`${defaults[p.name].replace(/\|/g, '\\|')}\`` : (p.optional ? '' : '**required**');
      out += `| \`${p.name}\` | \`${renderType(p.type)}\` | ${def} | ${p.doc.replace(/\|/g, '\\|')} |\n`;
    }
  }
  if (base) {
    out += `\nPlus everything on [\`${base}\`](../base-props.md).\n`;
  }
  return out;
}

const START = '<!-- props:start -->';
const END = '<!-- props:end -->';

let created = 0;
let synced = 0;
const unwritten = [];
const missingPage = [];
const stale = [];

for (const entry of CATALOG) {
  const section = PRIMITIVES.has(entry.component)
    ? PRIMITIVE_SECTION
    : SECTIONS[OVERRIDES[entry.component] ?? entry.category];
  if (!section) { console.warn(`no section for category ${entry.category} (${entry.component})`); continue; }

  const dir = join(at('docs/components'), section.dir);
  mkdirSync(dir, { recursive: true });
  const slug = entry.component.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const file = join(dir, `${slug}.md`);

  const table = propsTable(entry);
  if (!existsSync(file)) {
    const authored = EXAMPLES[entry.component];
    if (!authored) { unwritten.push(entry.component); continue; }
    missingPage.push(entry.component);

    const setup = authored.setup ? `\n<!-- docs:setup\n${authored.setup.trim()}\n-->\n` : '';
    const notes = authored.notes ? `\n${authored.notes.trim()}\n` : '';
    const see = authored.seeAlso ? `\n## See also\n\n${authored.seeAlso.trim()}\n` : '';

    const body = `---
title: ${entry.component}
parent: ${section.title}
grand_parent: Components
---
${setup}
# ${entry.component}
{: .no_toc }

${authored.summary ?? entry.description}

\`\`\`tsx
${authored.example.trim()}
\`\`\`

## Props

${START}
${table}${END}
${entry.role && entry.role !== 'presentation' ? `\nRole: \`${entry.role}\`.\n` : ''}${notes}${see}`;
    if (!CHECK) writeFileSync(file, body);
    created++;
    continue;
  }

  const current = readFileSync(file, 'utf8');
  const next = current.replace(
    new RegExp(`${START}[\\s\\S]*?${END}`),
    `${START}\n${table}${END}`,
  );
  if (next !== current) {
    if (CHECK) stale.push(relative(ROOT, file));
    else writeFileSync(file, next);
    synced++;
  }
}

// The catalog: every component, grouped, one line each, linked to its page.
//
// Generated because the count is a moving target - it went 91, 94 in a single
// afternoon. A hand-kept list is a list that is missing the last three.
{
  const CATALOG_PAGE = at('docs/components/README.md');
  if (existsSync(CATALOG_PAGE)) {
    const slugOf = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const dirOf = (entry) => (PRIMITIVES.has(entry.component)
      ? PRIMITIVE_SECTION
      : SECTIONS[OVERRIDES[entry.component] ?? entry.category])?.dir;

    let table = `\n${CATALOG.length} components. Every one has a page.\n`;
    const filed = new Set();
    for (const [heading, match] of CATALOG_GROUPS) {
      // A primitive's registry category is `layout` or `display`, so without
      // this `box` lists twice - once as a primitive and once as a container.
      const rows = CATALOG.filter((c) =>
        match(c) && (heading === 'The four primitives' || !PRIMITIVES.has(c.component)));
      if (!rows.length) continue;
      table += `\n### ${heading}\n\n| | |\n| --- | --- |\n`;
      for (const entry of rows) {
        filed.add(entry.component);
        const pkg = entry.pkg ? ` <sup>${entry.pkg.replace('@textui/', '')}</sup>` : '';
        table += `| [\`${entry.component}\`](${dirOf(entry)}/${slugOf(entry.component)}.md)${pkg} | ${entry.description} |\n`;
      }
    }
    const missed = CATALOG.filter((c) => !filed.has(c.component));
    if (missed.length) {
      console.error(`Not in any catalog group: ${missed.map((c) => c.component).join(', ')}`);
      process.exitCode = 1;
    }

    const current = readFileSync(CATALOG_PAGE, 'utf8');
    const next = current.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}\n${table}${END}`);
    if (next !== current) {
      if (CHECK) stale.push(relative(ROOT, CATALOG_PAGE));
      else writeFileSync(CATALOG_PAGE, next);
      synced++;
    }
  }
}

// The shared bases, documented once. Same marker, same guarantee.
const SHARED_PAGE = at('docs/components/base-props.md');
if (existsSync(SHARED_PAGE)) {
  let tables = '';
  for (const name of ['BaseProps', 'BoxProps', 'TextProps', 'CanvasProps', 'SpacerProps']) {
    const iface = interfaces[name];
    if (!iface) continue;
    tables += `\n### ${name}\n\n`;
    if (iface.doc) tables += `${iface.doc}\n\n`;
    tables += '| Prop | Type | |\n| --- | --- | --- |\n';
    for (const m of iface.members) {
      tables += `| \`${m.name}\` | \`${renderType(m.type)}\` | ${m.doc.replace(/\|/g, '\\|')} |\n`;
    }
  }
  const current = readFileSync(SHARED_PAGE, 'utf8');
  const next = current.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}\n${tables}${END}`);
  if (next !== current) {
    if (CHECK) stale.push(relative(ROOT, SHARED_PAGE));
    else writeFileSync(SHARED_PAGE, next);
    synced++;
  }
}

// Now that every component has a page, a missing one is a regression rather
// than work in progress: adding component 95 without a page should fail here
// instead of shipping it undocumented.
if (CHECK && (missingPage.length || unwritten.length)) {
  if (missingPage.length) console.error(`No page: ${missingPage.join(', ')}`);
  if (unwritten.length) console.error(`No authored example: ${unwritten.join(', ')}`);
  console.error('\nRun: node scripts/docs/gen-components.mjs');
  process.exit(1);
}

if (CHECK && stale.length) {
  console.error(`Prop tables out of date with the source:\n  ${stale.join('\n  ')}\n\nRun: node scripts/docs/gen-components.mjs`);
  process.exit(1);
}
console.log(`pages created: ${created}, prop tables synced: ${synced}, total: ${CATALOG.length}`);
if (unwritten.length) {
  console.log(`\nno example authored yet (${unwritten.length}): ${unwritten.join(' ')}`);
}
