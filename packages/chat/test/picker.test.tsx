import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import type { TextUIApp } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ComposerBar, PICKER, chipId, openPicker } from '../src/index.js';

/**
 * The palette, anchored to the chip that asked.
 *
 * It is one layer with one id, so the three things that matter are: it opens
 * on the command's values, the same chip closes it, and another chip's
 * question replaces it rather than stacking on it.
 */

const register = (app: TextUIApp, id: string, title: string, choices: { value: string; label: string }[]): void => {
  app.commands.register({
    id,
    title,
    slots: ['palette'],
    args: [{ name: 'value', type: 'string', required: true, choices }],
    run: () => {},
  });
};

const open = async (): Promise<Harness> => {
  const t = await renderApp({
    width: 60,
    height: 16,
    theme: 'workbench',
    root: h('box', { padding: [8, 0, 0, 0] }, h(ComposerBar, {
      options: [{ id: 'mode', label: 'Plan', commandId: 'set.mode' }],
      onOpen: () => undefined,
      onSend: () => undefined,
    })),
  });
  t.app.focus.focus(chipId('mode'));
  register(t.app, 'set.mode', 'Mode', [{ value: 'plan', label: 'Plan only' }, { value: 'edit', label: 'Accept edits' }]);
  register(t.app, 'set.pace', 'Pace', [{ value: 'slow', label: 'Deliberate' }, { value: 'fast', label: 'Brisk' }]);
  await t.settle();
  return t;
};

const showing = (t: Harness): boolean => t.app.layers.entries().some((e) => e.id === PICKER);

describe('the picker', () => {
  it('opens on the command\'s values', async () => {
    const t = await open();
    openPicker(t.app, { commandId: 'set.mode', anchorId: chipId('mode') });
    for (let i = 0; i < 6; i++) await t.settle();
    expect(showing(t)).toBe(true);
    expect(t.hasText('Plan only')).toBe(true);
    expect(t.hasText('Accept edits')).toBe(true);
    await t.unmount();
  });

  it('does nothing for a command nobody registered', async () => {
    const t = await open();
    openPicker(t.app, { commandId: 'set.nothing', anchorId: chipId('mode') });
    await t.settle();
    expect(showing(t)).toBe(false);
    await t.unmount();
  });

  it('closes when the same question is asked again', async () => {
    const t = await open();
    openPicker(t.app, { commandId: 'set.mode', anchorId: chipId('mode') });
    for (let i = 0; i < 6; i++) await t.settle();
    openPicker(t.app, { commandId: 'set.mode', anchorId: chipId('mode') });
    for (let i = 0; i < 6; i++) await t.settle();
    expect(showing(t)).toBe(false);
    await t.unmount();
  });

  it('swaps to another question rather than stacking', async () => {
    const t = await open();
    openPicker(t.app, { commandId: 'set.mode', anchorId: chipId('mode') });
    for (let i = 0; i < 6; i++) await t.settle();
    openPicker(t.app, { commandId: 'set.pace', anchorId: chipId('mode') });
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.layers.entries().filter((e) => e.id === PICKER)).toHaveLength(1);
    expect(t.hasText('Deliberate')).toBe(true);
    expect(t.hasText('Plan only')).toBe(false);
    await t.unmount();
  });

  it('gives the keyboard back to the chip on escape', async () => {
    const t = await open();
    openPicker(t.app, { commandId: 'set.mode', anchorId: chipId('mode') });
    for (let i = 0; i < 6; i++) await t.settle();
    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(showing(t)).toBe(false);
    expect(t.app.focus.focused()).toBe(chipId('mode'));
    await t.unmount();
  });
});
