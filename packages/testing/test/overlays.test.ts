import { describe, expect, it } from 'vitest';
import type { TextUIApp } from '@textui/core';
import { defineComponent, h, useCommand, useFocus, useFocusScope, useState } from '@textui/core';
import { prompt } from '@textui/widgets';
import { render, renderApp } from '../src/index.js';

function promptDialog(app: TextUIApp) {
  return prompt(app.layers, {
    title: 'Rename',
    message: 'New name',
    initialValue: 'billing-worker',
  });
}

/**
 * Overlays: focus inside them, the shape of their buttons, and the palette.
 *
 * The focus tests are the important ones. A trapped scope filters the tab
 * order down to itself, so a control that registered anywhere else is not
 * merely out of order - it is unreachable, and the dialog looks broken in a
 * way no error reports.
 */

function dialogApp(options: { actions?: boolean } = {}) {
  return (app: TextUIApp): void => {
    app.layers.open({
      id: 'd',
      layer: 'modal',
      trapFocus: true,
      node: {
        component: 'Dialog',
        title: 'Rename',
        width: 44,
        actions: options.actions === false ? [] : [
          { id: 'ok', label: 'OK', tone: 'primary' },
          { id: 'cancel', label: 'Cancel' },
        ],
        children: { component: 'TextInput', value: 'billing-worker', label: 'New name' },
      },
    });
  };
}

describe('focus inside a trapped overlay', () => {
  it('reaches every control with tab', async () => {
    const t = await renderApp({ width: 60, height: 12, onBoot: dialogApp() });
    await t.settle();

    const seen: (string | undefined)[] = [t.focused()?.label];
    for (let i = 0; i < 3; i++) {
      t.tab();
      await t.settle();
      seen.push(t.focused()?.label);
    }

    // Three controls, and the fourth tab comes back round to the first.
    expect(seen).toEqual(['OK', 'Cancel', 'New name', 'OK']);
    await t.unmount();
  });

  it('goes backwards too', async () => {
    const t = await renderApp({ width: 60, height: 12, onBoot: dialogApp() });
    await t.settle();

    t.shiftTab();
    await t.settle();
    expect(t.focused()?.label).toBe('New name');
    await t.unmount();
  });

  it('does not leak into what the trap covers', async () => {
    const t = await renderApp({
      width: 60,
      height: 14,
      onBoot: (app) => {
        app.open({
          surface: 'main',
          key: 'base',
          target: { component: 'Button', label: 'underneath', autoFocus: true },
        });
        dialogApp()(app);
      },
    });
    await t.settle();

    const labels = new Set<string | undefined>();
    for (let i = 0; i < 6; i++) {
      t.tab();
      await t.settle();
      labels.add(t.focused()?.label);
    }

    expect(labels.has('underneath')).toBe(false);
    expect(labels.has('New name')).toBe(true);
    await t.unmount();
  });

  it('files a control in the scope that encloses it', async () => {
    const Inner = defineComponent('Inner', () => {
      const focus = useFocus({});
      return h('box', { id: focus.id, label: 'inner' });
    });
    const Outer = defineComponent('Outer', () => {
      const scope = useFocusScope({ id: 'outer-scope', trap: true });
      return h('box', { direction: 'column' },
        h('text', { content: `scope=${scope}` }),
        h(Inner, {}));
    });

    const t = await render(h(Outer, {}), { width: 40, height: 5 });
    await t.settle();

    // The trap can only find it if it registered in the trapping scope.
    expect(t.app.focus.order()).toHaveLength(1);
    await t.unmount();
  });

  it('restores focus to what opened it', async () => {
    const t = await renderApp({
      width: 60,
      height: 14,
      onBoot: (app) => {
        app.open({
          surface: 'main',
          key: 'base',
          target: { component: 'Button', label: 'opener', autoFocus: true },
        });
      },
    });
    await t.settle();
    expect(t.focused()?.label).toBe('opener');

    const layer = t.app.layers.open({
      id: 'd',
      layer: 'modal',
      trapFocus: true,
      node: { component: 'Dialog', title: 'Hi', actions: [{ id: 'ok', label: 'OK' }] },
    });
    await t.settle();
    expect(t.focused()?.label).toBe('OK');

    layer.dispose();
    await t.settle();
    expect(t.focused()?.label).toBe('opener');
    await t.unmount();
  });
});

describe('autoFocus', () => {
  it('claims focus but does not steal it from a sibling that already has it', async () => {
    const t = await renderApp({
      width: 60,
      height: 12,
      onBoot: (app) => {
        // A prompt is the case: an auto-focused field *and* a default button.
        void promptDialog(app);
      },
    });
    await t.settle();

    expect(t.focused()?.component).toBe('TextInput');
    t.type('x');
    await t.settle();
    expect(t.hasText('billing-workerx')).toBe(true);
    await t.unmount();
  });

  it('names the field after the question, without drawing it twice', async () => {
    const t = await renderApp({ width: 60, height: 12, onBoot: (app) => void promptDialog(app) });
    await t.settle();

    // The field carries the question as its accessible name...
    expect(t.getByRole('textbox').label).toBe('New name');
    // ...and the message appears once, above the field, not inside it.
    expect(t.lines().filter((line) => line.includes('New name'))).toHaveLength(1);
    await t.unmount();
  });
});

describe('dialog buttons', () => {
  it('line up whatever variant they are', async () => {
    const t = await renderApp({ width: 60, height: 12, onBoot: dialogApp() });
    await t.settle();

    const ok = t.getByRole('button', { name: 'OK' });
    const cancel = t.getByRole('button', { name: 'Cancel' });

    // Same row, same height: a solid button reserves the ring an outline one
    // draws rather than being two rows shorter than its neighbour.
    expect(ok.rect?.y).toBe(cancel.rect?.y);
    expect(ok.rect?.height).toBe(cancel.rect?.height);
    await t.unmount();
  });

  it('puts both labels on the same line', async () => {
    const t = await renderApp({ width: 60, height: 12, onBoot: dialogApp() });
    await t.settle();

    const row = t.lines().findIndex((line) => line.includes('Cancel'));
    expect(t.line(row)).toContain('OK');
    await t.unmount();
  });
});

describe('the command palette', () => {
  function palette(register: (app: TextUIApp) => void) {
    return renderApp({
      width: 72,
      height: 20,
      onBoot: (app) => {
        register(app);
        app.layers.open({
          id: 'p',
          layer: 'modal',
          trapFocus: true,
          node: { component: 'CommandPalette', width: 60 },
        });
      },
    });
  }

  it('runs the command itself, so a caller wires nothing', async () => {
    const ran: string[] = [];
    const t = await palette((app) => {
      app.commands.register({
        id: 'svc.restart', title: 'Restart service', slots: ['palette'],
        run: () => ran.push('restart'),
      });
    });
    await t.settle();

    t.press('enter');
    await t.settle();
    expect(ran).toEqual(['restart']);
    await t.unmount();
  });

  it('shows the category, the keybinding and what the command does', async () => {
    const t = await palette((app) => {
      app.commands.register({
        id: 'svc.restart',
        title: 'Restart service',
        category: 'Services',
        description: 'Stops it, waits, starts it again.',
        slots: ['palette'],
        run: () => {},
      });
      app.keybindings.register({ keys: 'ctrl+r', commandId: 'svc.restart' });
    });
    await t.settle();

    expect(t.hasText('Restart service')).toBe(true);
    expect(t.hasText('Services')).toBe(true);
    expect(t.hasText('ctrl+r')).toBe(true);
    // The footer explains the highlighted row rather than making you run it.
    expect(t.hasText('Stops it, waits, starts it again.')).toBe(true);
    await t.unmount();
  });

  it('rules between categories', async () => {
    const t = await palette((app) => {
      app.commands.register({ id: 'a.one', title: 'One', category: 'Alpha', slots: ['palette'], run: () => {} });
      app.commands.register({ id: 'a.two', title: 'Two', category: 'Alpha', slots: ['palette'], run: () => {} });
      app.commands.register({ id: 'b.three', title: 'Three', category: 'Beta', slots: ['palette'], run: () => {} });
    });
    await t.settle();

    const one = t.lines().findIndex((l) => l.includes('One'));
    const two = t.lines().findIndex((l) => l.includes('Two'));
    const three = t.lines().findIndex((l) => l.includes('Three'));

    expect(two - one).toBe(1);      // same group, adjacent
    expect(three - two).toBe(2);    // a rule between the groups
    await t.unmount();
  });

  describe('sub-items', () => {
    function withChoices(choices: string[] | (() => string[] | Promise<string[]>)) {
      const ran: Record<string, unknown>[] = [];
      return {
        ran,
        mount: () => palette((app) => {
          app.commands.register({
            id: 'demo.toast',
            title: 'Show a toast',
            category: 'Demo',
            slots: ['palette'],
            args: [{ name: 'tone', type: 'string', required: true, choices, description: 'How loud.' }],
            run: (args) => ran.push(args),
          });
        }),
      };
    }

    it('asks for the argument instead of running blind', async () => {
      const { ran, mount } = withChoices(['info', 'danger']);
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();

      expect(ran).toEqual([]);
      expect(t.hasText('info')).toBe(true);
      expect(t.hasText('danger')).toBe(true);
      expect(t.hasText('How loud.')).toBe(true);
      await t.unmount();
    });

    it('runs with the choice that was picked', async () => {
      const { ran, mount } = withChoices(['info', 'danger']);
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();
      t.press('down');
      t.press('enter');
      await t.settle();

      expect(ran).toEqual([{ tone: 'danger' }]);
      await t.unmount();
    });

    it('resolves choices that come from a function', async () => {
      const { ran, mount } = withChoices(() => ['from', 'a', 'registry']);
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();
      expect(t.hasText('registry')).toBe(true);

      t.press('enter');
      await t.settle();
      expect(ran).toEqual([{ tone: 'from' }]);
      await t.unmount();
    });

    /**
     * A list with nothing in it is an answer, and a common one: an agent host
     * advertises a harness and no models until somebody has signed into it. It
     * used to draw as an empty box with "enter choose" underneath - which is
     * the same picture as a request still in flight, and enter did nothing on
     * either of them.
     */
    it('says so when there is nothing to choose', async () => {
      const { ran, mount } = withChoices(() => []);
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();
      expect(t.hasText('Nothing to choose')).toBe(true);
      // And it is not a row: pressing enter on it does not run the command
      // with an argument nobody picked.
      t.press('enter');
      await t.settle();
      expect(ran).toEqual([]);
      await t.unmount();
    });

    it('says it is still asking while the answer is on its way', async () => {
      let answer: (list: string[]) => void = () => undefined;
      const { mount } = withChoices(() => new Promise<string[]>((resolve) => { answer = resolve; }));
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();
      expect(t.hasText('Asking')).toBe(true);
      expect(t.hasText('Nothing to choose')).toBe(false);

      answer(['info', 'danger']);
      await t.settle();
      await t.settle();
      expect(t.hasText('danger')).toBe(true);
      expect(t.hasText('Asking')).toBe(false);
      await t.unmount();
    });

    /**
     * A choice that has to be explained.
     *
     * An agent's approval modes are five phrases that all sound alike - "Auto
     * Mode", "Plan Mode", "Ask Before Edits" - and the sentence under each one
     * is what tells them apart. So a choice carries a mark, a label and a line
     * of its own, and the command is handed the *value* rather than whatever
     * the label happened to say.
     */
    it('shows a choice with its mark and its own sentence', async () => {
      const { ran, mount } = withChoices([
        { value: 'plan', label: 'Plan Mode', icon: '=', description: 'Writes a plan first' },
        { value: 'bypass', label: 'Bypass', icon: '!', description: 'Nothing is confirmed' },
      ]);
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();
      expect(t.hasText('Plan Mode')).toBe(true);
      expect(t.hasText('Writes a plan first')).toBe(true);

      t.press('enter');
      await t.settle();
      expect(ran).toEqual([{ tone: 'plan' }]);
      await t.unmount();
    });

    it('finds a choice by what it does, not only by what it is called', async () => {
      const { ran, mount } = withChoices([
        { value: 'default', label: 'Ask Before Edits', description: 'Asks before editing files' },
        { value: 'acceptEdits', label: 'Edit Automatically', description: 'Edits without asking' },
      ]);
      const t = await mount();
      await t.settle();
      t.press('enter');
      await t.settle();

      // Neither label contains "without". The description does, and it is what
      // a person remembers about a mode whose name is two generic words.
      t.type('without');
      await t.settle();
      t.press('enter');
      await t.settle();
      expect(ran).toEqual([{ tone: 'acceptEdits' }]);
      await t.unmount();
    });

    it('goes back a level on escape rather than closing', async () => {
      const { mount } = withChoices(['info', 'danger']);
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();
      expect(t.hasText('danger')).toBe(true);

      t.press('escape');
      await t.settle();
      expect(t.hasText('Show a toast')).toBe(true);
      expect(t.hasText('danger')).toBe(false);
      await t.unmount();
    });

    it('filters the choices too', async () => {
      const { ran, mount } = withChoices(['info', 'success', 'warning', 'danger']);
      const t = await mount();
      await t.settle();

      t.press('enter');
      await t.settle();
      t.type('warn');
      await t.settle();

      expect(t.hasText('info')).toBe(false);
      t.press('enter');
      await t.settle();
      expect(ran).toEqual([{ tone: 'warning' }]);
      await t.unmount();
    });
  });

  it('is a picker when told not to execute', async () => {
    const ran: string[] = [];
    const chosen: string[] = [];
    const t = await renderApp({
      width: 72,
      height: 16,
      onBoot: (app) => {
        app.commands.register({ id: 'x', title: 'Something', slots: ['palette'], run: () => ran.push('x') });
        app.layers.open({
          id: 'p',
          layer: 'modal',
          trapFocus: true,
          node: {
            component: 'CommandPalette',
            execute: false,
            onRun: { handler: (id: string) => chosen.push(id) },
          },
        });
      },
    });
    await t.settle();

    t.press('enter');
    await t.settle();
    expect(chosen).toEqual(['x']);
    expect(ran).toEqual([]);
    await t.unmount();
  });
});

describe('a button and the palette are the same act', () => {
  it('reaches the same command from both', async () => {
    const opened: string[] = [];

    const Screen = defineComponent('Screen', () => {
      const [count, setCount] = useState(0);
      useCommand({
        id: 'demo.open',
        title: 'Open the thing',
        category: 'Demo',
        slots: ['palette'],
        run: () => {
          opened.push('open');
          setCount(count + 1);
        },
      }, [count]);

      return h('box', { direction: 'column' },
        h('Button', { label: 'Open', autoFocus: true, onPress: () => void 0 }),
        h('text', { content: `opened=${count}` }));
    });

    const t = await renderApp({
      width: 60,
      height: 14,
      onBoot: (app) => app.open({ surface: 'main', key: 's', target: h(Screen, {}) }),
    });
    await t.settle();

    // Through the registry, the way a button's `execute` would.
    await t.app.execute('demo.open');
    await t.settle();
    expect(t.hasText('opened=1')).toBe(true);

    // And through the palette, which found it without being told it exists.
    t.app.layers.open({
      id: 'p',
      layer: 'modal',
      trapFocus: true,
      node: { component: 'CommandPalette' },
    });
    await t.settle();
    expect(t.hasText('Open the thing')).toBe(true);

    t.press('enter');
    await t.settle();
    expect(opened).toEqual(['open', 'open']);
    await t.unmount();
  });
});

