// Pull component prop interfaces out of the packages' sources with the
// TypeScript compiler API.
//
// Prop tables in the docs are generated from this rather than typed by hand:
// a table that disagrees with the interface is worse than no table, and with
// eighty components a hand-kept one disagrees within a release.
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, at } from './root.mjs';

const UI_DIR = at('packages/widgets/src');
const CORE_UI_DIR = at('packages/core/src/ui');
const JSX_DIR = at('packages/core/src/jsx');

const files = [
  // Recursive: widgets is one file per component, in a folder per group.
  ...readdirSync(UI_DIR, { recursive: true })
    .filter((f) => String(f).endsWith('.ts'))
    .map((f) => join(UI_DIR, String(f))),
  // Screen and the four primitives stayed in core, with the runtime that
  // paints them.
  ...readdirSync(CORE_UI_DIR).filter((f) => f.endsWith('.ts')).map((f) => join(CORE_UI_DIR, f)),
  join(JSX_DIR, 'intrinsics.ts'),
  ...readdirSync(at('packages/core/src/types'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(at('packages/core/src/types'), f)),
  // The resource, JSON and editor components ship from @textui/documents, so
  // their props live outside core and would otherwise come out empty.
  ...readdirSync(at('packages/documents/src'), { recursive: true })
    .filter((f) => String(f).endsWith('.ts'))
    .map((f) => join(at('packages/documents/src'), String(f))),
];

/** JSDoc immediately above a node, as plain text. */
function docOf(node, source) {
  const ranges = ts.getLeadingCommentRanges(source.text, node.pos) ?? [];
  const block = ranges.filter((r) => source.text.slice(r.pos, r.pos + 3) === '/**').pop();
  if (!block) return '';
  return source.text
    .slice(block.pos, block.end)
    .replace(/^\s*\/\*\*/, '')
    .replace(/\*\/\s*$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*ate?/, '').replace(/^\s*\*ate?/, '').replace(/^\s*\* ?/, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const interfaces = {};
// Same interface name in two files is legal and happens - `SpacerProps` is
// declared for the primitive and again for the component. Keyed by name alone
// one silently wins, so keep a per-file index and let the caller disambiguate.
const byFile = {};
const defaults = {};
const aliases = {};

for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);

  source.forEachChild((node) => {
    // interface XProps extends YProps { ... }
    if (ts.isInterfaceDeclaration(node)) {
      const heritage = (node.heritageClauses ?? [])
        .flatMap((h) => h.types.map((t) => t.getText(source)));
      const record = {
        name: node.name.text,
        file: relative(ROOT, file),
        extends: heritage,
        doc: docOf(node, source),
        members: node.members.flatMap((m) => {
          if (!m.name) return [];
          const isMethod = ts.isMethodSignature(m);
          if (!ts.isPropertySignature(m) && !isMethod) return [];
          return [{
            name: m.name.getText(source),
            optional: !!m.questionToken,
            type: isMethod
              ? `(${m.parameters.map((p) => p.getText(source)).join(', ')}) => ${m.type ? m.type.getText(source) : 'void'}`
              : (m.type ? m.type.getText(source) : 'unknown'),
            doc: docOf(m, source),
          }];
        }),
      };
      (byFile[record.file] ??= {})[record.name] = record;
      interfaces[record.name] ??= record;
    }

    if (ts.isTypeAliasDeclaration(node)) {
      aliases[node.name.text] = node.type.getText(source).replace(/\s+/g, ' ').trim();
    }

    // const X = defineComponent<XProps>('X', (props) => { const { a = 1 } = props;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (!init || !ts.isCallExpression(init)) continue;
        const callee = init.expression.getText(source);
        if (!callee.startsWith('defineComponent')) continue;
        const nameArg = init.arguments[0];
        if (!nameArg || !ts.isStringLiteral(nameArg)) continue;
        const body = init.arguments[1]?.getText(source) ?? '';
        const found = {};
        // Only the first destructure of `props`, so a nested default elsewhere
        // in the body is not mistaken for a prop default.
        const m = body.match(/const\s*\{([\s\S]*?)\}\s*=\s*props\s*;/);
        if (m) {
          for (const part of m[1].split(/,(?![^{[(]*[}\])])/)) {
            const d = part.trim().match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
            if (d) found[d[1]] = d[2].trim().replace(/\s+/g, ' ');
          }
        }
        defaults[nameArg.text] = {
          propsType: init.typeArguments?.[0]?.getText(source) ?? null,
          file: relative(ROOT, file),
          defaults: found,
        };
      }
    }
  });
}

const out = { interfaces, byFile, components: defaults, aliases };
writeFileSync(at('scripts/docs/props.json'), JSON.stringify(out, null, 2));
console.log(`interfaces: ${Object.keys(interfaces).length}  components: ${Object.keys(defaults).length}  aliases: ${Object.keys(aliases).length}`);
