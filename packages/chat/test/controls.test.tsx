import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ComposerBar, SEND_ID, chipId, composerRows } from '../src/index.js';
import type { ComposerOption } from '../src/index.js';

/**
 * The control rows under the field.
 *
 * What runs is one row and where it runs is the next - but only when there is
 * a where. A host that asks nothing about the workspace keeps the one line
 * it always had, with send at the end of it, rather than a second row holding
 * nothing but send. Either way tab walks what, then where, then send.
 */

const WHAT: ComposerOption[] = [
  { id: 'harness', label: 'Claude Code', commandId: 'set.harness' },
  { id: 'model', label: 'sonnet', commandId: 'set.model' },
];

// Declared before the what chips, so the order below is by kind and not by
// the order the host happened to answer in.
const WHERE: ComposerOption[] = [
  { id: 'workspace', label: 'ahpc', commandId: 'set.workspace', where: true },
  { id: 'isolation', label: 'Worktree', commandId: 'set.isolation', where: true },
];

const open = async (options: ComposerOption[], props: Record<string, unknown> = {}): Promise<Harness> => {
  const t = await renderApp({
    width: 80,
    height: 6,
    theme: 'workbench',
    root: h(ComposerBar, { options, onOpen: () => undefined, onSend: () => undefined, ...props }),
  });
  await t.settle();
  await t.settle();
  return t;
};

/** The rows with anything on them. */
const drawn = (t: Harness): string[] => t.lines().filter((line) => line.trim() !== '');

/** Where tab goes from the first chip, until it comes back round. */
const walk = async (t: Harness, first: string, steps: number): Promise<(string | null)[]> => {
  t.app.focus.focus(first);
  await t.settle();
  const walked: (string | null)[] = [t.app.focus.focused()];
  for (let i = 0; i < steps; i += 1) {
    await t.press('tab');
    await t.settle();
    walked.push(t.app.focus.focused());
  }
  return walked;
};

describe('with a where chip', () => {
  it('draws two rows, and where the session runs is the second', async () => {
    const t = await open([...WHERE, ...WHAT]);
    const rows = drawn(t);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Claude Code');
    expect(rows[0]).toContain('sonnet');
    expect(rows[0]).not.toContain('ahpc');
    expect(rows[1]).toContain('ahpc');
    expect(rows[1]).toContain('Worktree');
    // Send ends the last row, whichever row that is.
    expect(rows[1]).toContain('send');
    expect(rows[0]).not.toContain('send');
    await t.unmount();
  });

  it('is tabbed through what, then where, then send', async () => {
    const t = await open([...WHERE, ...WHAT]);
    expect(await walk(t, chipId('harness'), 4)).toEqual([
      chipId('harness'), chipId('model'), chipId('workspace'), chipId('isolation'), SEND_ID,
    ]);
    await t.unmount();
  });

  it('is two rows to the composer', () => {
    expect(composerRows([...WHERE, ...WHAT])).toBe(2);
    expect(composerRows(WHERE)).toBe(2);
  });
});

describe('without a where chip', () => {
  it('draws the one row it always did, send and all', async () => {
    const t = await open(WHAT);
    const rows = drawn(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Claude Code');
    expect(rows[0]).toContain('sonnet');
    expect(rows[0]).toContain('send');
    await t.unmount();
  });

  it('is tabbed through the chips and then send, as before', async () => {
    const t = await open(WHAT);
    expect(await walk(t, chipId('harness'), 2)).toEqual([chipId('harness'), chipId('model'), SEND_ID]);
    await t.unmount();
  });

  it('is one row to the composer', () => {
    expect(composerRows(WHAT)).toBe(1);
    expect(composerRows([])).toBe(1);
  });
});

describe('escape on a chip', () => {
  it('leaves, once, and does not open the chip', async () => {
    let left = 0;
    let opened = 0;
    const t = await open(WHAT, { onLeave: () => { left += 1; }, onOpen: () => { opened += 1; } });
    t.app.focus.focus(chipId('model'));
    await t.settle();
    await t.press('escape');
    await t.settle();
    expect(left).toBe(1);
    expect(opened).toBe(0);
    await t.unmount();
  });

  it('is nobody\'s when there is no onLeave', async () => {
    const t = await open(WHAT);
    t.app.focus.focus(chipId('model'));
    await t.settle();
    await t.press('escape');
    await t.settle();
    // Still on the chip: the key went past it, and nothing on this screen
    // wanted it.
    expect(t.app.focus.focused()).toBe(chipId('model'));
    await t.unmount();
  });
});
