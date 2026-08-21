import { describe, expect, it, vi } from 'vitest';
import { renderApp, chordToEvents } from '../src/index.js';
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
