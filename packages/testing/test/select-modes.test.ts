import { describe, expect, it } from 'vitest';
import { h, useState } from '@textui/core';
import { Select } from '@textui/widgets';
import { renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/*
 * One control, three places to put its list.
 *
 * `inline` grows the control and moves what is under it. `floating` anchors
 * the list under the control on the floating layer, so the layout does not
 * jump. `modal` centres it over a scrim. The keys are the same in all three,
 * because the control keeps the keyboard in all three - the layer is somewhere
 * to draw the list, not somewhere the focus goes.
 */
describe('where a Select puts its options', () => {
  const OPTIONS = [
    { value: 'eu', label: 'eu-west-1' },
    { value: 'us', label: 'us-east-1' },
    { value: 'ap', label: 'ap-south-1' },
  ];

  const open = async (
    mode: 'inline' | 'floating' | 'modal',
    width = 40,
  ): Promise<{ t: Harness; chosen: string[] }> => {
    const chosen: string[] = [];
    const t = await renderApp({
      width,
      height: 14,
      root: h(function Host() {
        const [value, setValue] = useState('eu');
        return h('box', { direction: 'column', padding: 1 },
          h(Select, {
            label: 'Region',
            value,
            options: OPTIONS,
            mode,
            onChange: (v: string) => { setValue(v); chosen.push(v); },
          }),
          h('text', { content: 'under the control' }));
      }, {}),
    });
    for (let i = 0; i < 4; i++) await t.settle();
    t.tab();
    for (let i = 0; i < 2; i++) await t.settle();
    return { t, chosen };
  };

  /** The row the control's own bottom rule is on. */
  const bottom = (t: Harness): number => t.lines().findIndex((line) => line.includes('└'));

  for (const width of [40, 30]) {
    it(`opens the list in every mode at ${width} columns`, async () => {
      for (const mode of ['inline', 'floating', 'modal'] as const) {
        const { t } = await open(mode, width);
        expect(t.hasText('us-east-1'), `${mode} at ${width}`).toBe(false);

        t.press('enter');
        for (let i = 0; i < 4; i++) await t.settle();
        expect(t.hasText('us-east-1'), `${mode} at ${width}`).toBe(true);
        await t.unmount();
      }
    });
  }

  it('grows the control when it is inline', async () => {
    const { t } = await open('inline');
    const before = bottom(t);
    t.press('enter');
    for (let i = 0; i < 4; i++) await t.settle();
    // The options are inside the same frame, so the frame got taller.
    expect(bottom(t)).toBeGreaterThan(before);
    await t.unmount();
  });

  for (const mode of ['floating', 'modal'] as const) {
    it(`leaves the control the size it was when it is ${mode}`, async () => {
      // The whole reason for a layer: opening a control in a form should not
      // move the rest of the form.
      const { t } = await open(mode);
      const before = bottom(t);
      t.press('enter');
      for (let i = 0; i < 4; i++) await t.settle();
      expect(bottom(t)).toBe(before);
      await t.unmount();
    });
  }

  it('answers the same keys wherever the list is', async () => {
    for (const mode of ['inline', 'floating', 'modal'] as const) {
      const { t, chosen } = await open(mode);
      t.press('enter');
      for (let i = 0; i < 4; i++) await t.settle();
      t.press('down');
      t.press('enter');
      for (let i = 0; i < 4; i++) await t.settle();

      expect(chosen, mode).toEqual(['us']);
      // And it shut again.
      expect(t.hasText('ap-south-1'), mode).toBe(false);
      await t.unmount();
    }
  });

  it('closes on escape wherever the list is', async () => {
    for (const mode of ['inline', 'floating', 'modal'] as const) {
      const { t } = await open(mode);
      t.press('enter');
      for (let i = 0; i < 4; i++) await t.settle();
      expect(t.hasText('us-east-1'), mode).toBe(true);

      t.press('escape');
      for (let i = 0; i < 4; i++) await t.settle();
      expect(t.hasText('us-east-1'), mode).toBe(false);
      await t.unmount();
    }
  });

  it('takes the highlight with it as the arrows move', async () => {
    // The layer's content is patched rather than reopened, so this is the
    // assertion that the patch actually lands.
    const { t } = await open('floating');
    t.press('enter');
    for (let i = 0; i < 4; i++) await t.settle();
    const first = t.lines().find((line) => line.includes('eu-west-1') && line.includes('▸'));
    expect(first).toBeDefined();

    t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.lines().find((line) => line.includes('us-east-1') && line.includes('▸'))).toBeDefined();
    await t.unmount();
  });
});
