import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { Badge } from '../src/display/index.js';
import { CATALOG } from '../src/index.js';

// An imported component travels on its own node: `<Badge/>` compiles to a
// node carrying the function, and `findFunction` takes that in preference to
// looking the name up. So JSX needs no registry, and the registry is for the
// case JSX cannot cover - a component named by a string in data.
//
// This lives here rather than in core because it takes a widget to show it,
// and core cannot import one.
describe('what has to be registered', () => {
  for (const width of [24, 60]) {
    it(`renders an imported component with an empty registry at ${width} columns`, () => {
      expect(renderToString(h(Badge, { label: 'ok' }), { width })).toContain('ok');
    });
  }

  it('renders the miss when the same component is named in data', () => {
    expect(renderToString({ component: 'Badge', label: 'ok' }, { width: 24 })).toBe('<Badge>');
  });

  it('renders it once the catalog is passed', () => {
    const out = renderToString({ component: 'Badge', label: 'ok' }, { width: 24, components: CATALOG });
    expect(out).toContain('ok');
  });
});
