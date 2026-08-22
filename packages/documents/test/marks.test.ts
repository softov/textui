import { describe, expect, it } from 'vitest';
import { registerBuiltins, setLineMarks } from '@textui/core';
import type { Resource, ResourceProvider } from '@textui/core';
import { renderApp } from '@textui/testing';
import { openDocument, registerDocuments } from '../src/index.js';

/**
 * The gutter marks, in whatever is drawing the file.
 *
 * "This line changed" is true of the file, not of whether you happen to be
 * editing it - and it lived only in `CodeEditor`, so turning the setting on
 * while *reading* did nothing at all. The failure was silent and it looked
 * like a colour problem: the wash was refused below 24-bit, so the warning
 * about colours fired, and the marks that were supposed to be the fallback
 * were never drawn by the viewer in the first place. The threshold has since
 * come down to 256 (see `tint.test.ts`); the marks never needed either.
 */

const URI = 'mem:///a.ts';
const TEXT = 'one\ntwo\nthree\nfour';

/** Enough of a provider that both components can resolve one URI. */
function provider(): ResourceProvider {
  return {
    scheme: 'mem',
    stat: (uri) => Promise.resolve<Resource>({
      uri, kind: 'file.code', metadata: { name: 'a.ts' }, capabilities: ['read', 'write'],
    }),
    read: () => Promise.resolve(TEXT),
    write: () => Promise.resolve(),
  };
}

async function open(component: string, colorDepth: 24 | 8) {
  const t = await renderApp({
    width: 44, height: 8,
    capabilities: { colorDepth },
    onBoot: (app) => {
      registerBuiltins(app);
      registerDocuments(app);
      app.resources.registerProvider(provider());
    },
    root: {
      component: 'box', direction: 'column', flex: 1,
      // The editor reads the buffer behind the URI; the viewer is given the
      // text. Both are pointed at the same URI, which is what the marks are
      // keyed by, and that is the whole point of the comparison.
      children: { component, flex: 1, content: TEXT, uri: URI, lineNumbers: true },
    },
  });
  const settle = async (n = 4): Promise<void> => {
    for (let i = 0; i < n; i++) { await t.settle(); t.flush(); }
  };
  await openDocument(t.app, URI);
  await settle();
  setLineMarks(t.app.store, 'git', URI, { 1: 'changed', 3: 'added' });
  await settle();
  return { t, settle };
}

describe('marks in the gutter', () => {
  // Both renderers, because they draw the same file and used to disagree.
  for (const component of ['CodeViewer', 'CodeEditor']) {
    // Both depths, because the wash has a threshold and the marks never did.
    for (const depth of [24, 8] as const) {
      it(`${component} draws them at ${depth}-bit colour`, async () => {
        const { t } = await open(component, depth);
        const lines = t.lines();
        expect(lines[1], 'the changed line').toContain('~');
        expect(lines[3], 'the added line').toContain('+');
        expect(lines[0], 'and nothing on a line nobody marked').not.toContain('~');
        await t.unmount();
      });
    }
  }

  it('spends no column when nothing is marked', async () => {
    const t = await renderApp({
      width: 44, height: 8,
      onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
      root: {
        component: 'box', direction: 'column', flex: 1,
        children: { component: 'CodeViewer', flex: 1, content: TEXT, uri: URI, lineNumbers: true },
      },
    });
    for (let i = 0; i < 4; i++) { await t.settle(); t.flush(); }
    // `1 one`, with one space after the number and no cell held for a mark.
    expect(t.lines()[0]).toContain('1 one');
    await t.unmount();
  });
});
