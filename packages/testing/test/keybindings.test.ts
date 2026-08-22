import { describe, expect, it, vi } from 'vitest';
import { h, defineComponent, useState } from '@textui/core';
import { render, renderApp, chordToEvents } from '../src/index.js';
import { splitStroke, strokeOf, normalizeStroke } from '@textui/core';

/**
 * Chords, and the one grammar behind them.
 *
 * `+` is both the separator and a key, which is what makes these worth
 * pinning: a parser that splits on `+` answers `''` when asked about `+`,
 * and the binding it stored then never matches the key that was pressed.
 */

const CHORDS = [
  '+', '-', '=', 'a', 'A', 'z', '/', '.', ',', ';', "'", '[', ']', '\\',
  'ctrl+r', 'ctrl++', 'ctrl+-', 'alt++', 'shift+tab', 'ctrl+shift+p',
  'meta+s', 'cmd+s', 'control+c', 'option+f', 'enter', 'escape', 'space',
];

describe('splitStroke', () => {
  it.each([
    ['+',            [],                  '+'],
    ['-',            [],                  '-'],
    ['ctrl++',       ['ctrl'],            '+'],
    ['ctrl+r',       ['ctrl'],            'r'],
    ['ctrl+shift+p', ['ctrl', 'shift'],   'p'],
    ['alt++',        ['alt'],             '+'],
    ['shift+tab',    ['shift'],           'tab'],
    ['cmd+s',        ['cmd'],             's'],
    ['a',            [],                  'a'],
  ])('splits %j', (stroke, mods, key) => {
    expect(splitStroke(stroke)).toEqual({ mods, key });
  });
});

describe('a pressed chord matches the binding it was registered under', () => {
  // The property that `+` violated: whatever the harness sends for a chord
  // has to normalise back to the stroke the registry filed that chord under.
  it.each(CHORDS)('round-trips %j', (chord) => {
    const events = chordToEvents(chord);
    expect(events).toHaveLength(1);
    expect(strokeOf(events[0]!)).toBe(normalizeStroke(chord));
  });

  it.each(CHORDS)('fires a command bound to %j', async (chord) => {
    const run = vi.fn();
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'test.chord', title: 'Chord', run });
        app.keybindings.register({ keys: chord, commandId: 'test.chord' });
      },
    });
    t.press(chord);
    await t.settle();
    expect(run, `chord ${chord} did not fire`).toHaveBeenCalledTimes(1);
    await t.unmount();
  });
});

describe('+ from a real terminal', () => {
  it('fires the binding when the byte arrives from the decoder', async () => {
    const fired: string[] = [];
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'demo.inc', title: 'Inc', run: () => fired.push('+') });
        app.keybindings.register({ keys: '+', commandId: 'demo.inc' });
        app.commands.register({ id: 'demo.dec', title: 'Dec', run: () => fired.push('-') });
        app.keybindings.register({ keys: '-', commandId: 'demo.dec' });
      },
    });
    t.feed('+');
    t.feed('-');
    await t.settle();
    expect(fired).toEqual(['+', '-']);
    await t.unmount();
  });
});

/**
 * The keys a person actually presses.
 *
 * `press` synthesises an event; a terminal sends bytes. Where the two disagree
 * a binding works in a test and never in the product, which is the one failure
 * a test harness must not have - so these go in as bytes.
 */
describe('a key pressed as bytes', () => {
  it('reaches a binding registered as space', async () => {
    let ran = 0;
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'toggle', title: 'Toggle', run: () => { ran++; } });
        app.keybindings.register({ keys: 'space', commandId: 'toggle' });
      },
    });

    // 0x20, the byte a space bar sends. `KeyName` has listed `space` from the
    // start and nothing ever received one.
    t.feed(' ');
    await t.settle();

    expect(ran).toBe(1);
    await t.unmount();
  });

  it('still types a space into a field', async () => {
    const Field = defineComponent('Field', () => {
      const [value, setValue] = useState('');
      return h('TextInput', { value, onChange: setValue, label: 'name', autoFocus: true, width: 20 });
    });
    const t = await render(h(Field, {}), { width: 30, height: 3 });
    await t.settle();
    t.focus(t.getByRole('textbox').id);

    t.feed('a b');
    await t.settle();

    expect(t.hasText('a b')).toBe(true);
    await t.unmount();
  });
});

/**
 * Shift, beside another modifier.
 *
 * The round-trip property above is satisfied by *any* consistent collapse -
 * including one that maps two different chords onto the same stroke, which is
 * what happened: `ctrl+shift+f` was filed under `ctrl+f`, so the workspace
 * search sat behind the in-file search and its documented key ran the other
 * command. The missing property is that distinct chords stay distinct.
 */
describe('shift is part of a stroke when it is not the only modifier', () => {
  it.each([
    ['ctrl+shift+f',  'ctrl+shift+f'],
    ['ctrl+shift+b',  'ctrl+shift+b'],
    ['alt+shift+/',   'alt+shift+/'],
    // Canonical order is ctrl, alt, shift, meta - so shift lands before it.
    ['meta+shift+p',  'shift+meta+p'],
    ['ctrl+shift+tab','ctrl+shift+tab'],
  ])('%j stays %j', (chord, stroke) => {
    expect(normalizeStroke(chord)).toBe(stroke);
  });

  // The half that is deliberate. A bare shift+p is the character `P`, and the
  // terminal reports no shift bit beside it, so a binding naming shift there
  // would wait for a stroke nothing sends.
  it.each([
    ['shift+p', 'p'],
    ['shift+/', '/'],
    ['P',       'p'],
  ])('%j collapses to %j, because a shifted character carries no shift bit', (chord, stroke) => {
    expect(normalizeStroke(chord)).toBe(stroke);
  });

  it('gives every distinguishable chord its own stroke', () => {
    const chords = [
      'f', 'ctrl+f', 'ctrl+shift+f', 'alt+f', 'alt+shift+f', 'ctrl+alt+f',
      'b', 'ctrl+b', 'ctrl+shift+b', 'tab', 'shift+tab', 'ctrl+tab',
      'ctrl+shift+tab', '/', 'alt+/', 'alt+shift+/', 'alt+?',
    ];
    const strokes = chords.map(normalizeStroke);
    expect(new Set(strokes).size, `collided: ${strokes.join(' ')}`).toBe(chords.length);
  });

  // `strokeOf` reads events, `normalizeStroke` reads text, and a disagreement
  // between them is a binding that never fires. Meta is the one that ordering
  // could break, because it is pushed after shift.
  it.each(['ctrl+shift+f', 'alt+shift+/', 'meta+shift+p', 'ctrl+alt+shift+p'])(
    'reads %j back off the event',
    (chord) => {
      const events = chordToEvents(chord);
      expect(strokeOf(events[0]!)).toBe(normalizeStroke(chord));
    },
  );

  it('runs the shifted binding and not the one it used to hide behind', async () => {
    const plain = vi.fn();
    const shifted = vi.fn();
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'test.plain', title: 'Plain', run: plain });
        app.commands.register({ id: 'test.shifted', title: 'Shifted', run: shifted });
        // Registered in this order on purpose: the collision resolved to
        // whichever came first, so the plain one won every time.
        app.keybindings.register({ keys: 'ctrl+f', commandId: 'test.plain' });
        app.keybindings.register({ keys: 'ctrl+shift+f', commandId: 'test.shifted' });
      },
    });

    t.press('ctrl+shift+f');
    await t.settle();
    expect(shifted).toHaveBeenCalledTimes(1);
    expect(plain).not.toHaveBeenCalled();

    t.press('ctrl+f');
    await t.settle();
    expect(plain).toHaveBeenCalledTimes(1);
    expect(shifted).toHaveBeenCalledTimes(1);

    await t.unmount();
  });
});
