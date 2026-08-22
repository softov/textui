#!/usr/bin/env node
import { renderApp } from '../packages/testing/dist/index.js';

/**
 * What a frame costs.
 *
 * Four shapes, because one shape is one answer: a value changing inside a
 * static screen, a list scrolling, a whole screen of text being replaced, and
 * something animating. They stress different halves - the first barely touches
 * layout, the last repaints everything every frame.
 *
 * Run it before a change and after. `node scripts/bench.mjs`, or with a name
 * to run one: `node scripts/bench.mjs scroll`.
 *
 * Numbers move between machines and between runs; what matters is the ratio
 * against the run you did five minutes ago on the same machine.
 */

const WIDTH = 200;
const HEIGHT = 60;

const rows = Array.from({ length: 400 }, (_, i) => ({
  id: String(i),
  label: `row ${i} of the list`,
}));

const paragraph = Array.from({ length: 300 }, (_, i) =>
  `line ${i}: the quick brown fox jumps over the lazy dog, repeatedly and at length`).join('\n');

/** One number changing inside a screen that is otherwise still. */
async function counter() {
  const t = await renderApp({
    width: WIDTH, height: HEIGHT,
    initialState: { '$/app/n': 0 },
    root: {
      component: 'box', direction: 'column', flex: 1,
      children: [
        { component: 'text', content: { $: '$/app/n' } },
        { component: 'List', items: rows, visibleRows: 50, flex: 1 },
      ],
    },
  });
  return { t, step: (i) => t.app.store.set('$/app/n', i) };
}

/** The same list, scrolled. Every row moves, so every cell is repainted. */
async function scroll() {
  const t = await renderApp({
    width: WIDTH, height: HEIGHT,
    initialState: { '$/app/at': 0 },
    root: {
      component: 'box', direction: 'column', flex: 1,
      children: [{
        component: 'List', items: rows, visibleRows: 50, flex: 1,
        selectedId: { $: '$/app/at' },
      }],
    },
  });
  return { t, step: (i) => t.app.store.set('$/app/at', String(i % rows.length)) };
}

/** A screenful of prose, rewritten. Measurement and wrapping, not just paint. */
async function text() {
  const t = await renderApp({
    width: WIDTH, height: HEIGHT,
    initialState: { '$/app/text': paragraph },
    root: {
      component: 'box', flex: 1,
      children: [{ component: 'text', content: { $: '$/app/text' }, wrap: 'word', flex: 1 }],
    },
  });
  return {
    t,
    // A different first line each frame, so nothing can be reused wholesale.
    step: (i) => t.app.store.set('$/app/text', `frame ${i}\n${paragraph}`),
  };
}

/**
 * Animation: a bar that moves, over a screen that does not.
 *
 * The shape a dirty-rectangle painter would win most on - a handful of cells
 * change and the other twelve thousand are identical to last frame.
 */
async function animate() {
  const t = await renderApp({
    width: WIDTH, height: HEIGHT,
    initialState: { '$/app/pct': 0 },
    root: {
      component: 'box', direction: 'column', flex: 1,
      children: [
        { component: 'ProgressBar', value: { $: '$/app/pct' }, max: 100, width: 60 },
        { component: 'List', items: rows, visibleRows: 50, flex: 1 },
      ],
    },
  });
  return { t, step: (i) => t.app.store.set('$/app/pct', i % 100) };
}

const SHAPES = { counter, scroll, text, animate };

async function run(name, frames) {
  const { t, step } = await SHAPES[name]();
  for (let i = 0; i < 8; i++) await t.settle();

  // Warm, so the first measured frame is not paying for compilation.
  for (let i = 0; i < 30; i++) { step(i); t.flush(); }

  const start = performance.now();
  for (let i = 0; i < frames; i++) { step(i); t.flush(); }
  const ms = performance.now() - start;

  await t.unmount();
  return ms / frames;
}

const only = process.argv[2];
const names = only ? [only] : Object.keys(SHAPES);
const frames = Number(process.argv[3] ?? 300);

for (const name of names) {
  if (!SHAPES[name]) {
    process.stdout.write(`no such shape: ${name}\n`);
    process.exit(1);
  }
  const per = await run(name, frames);
  process.stdout.write(`${name.padEnd(9)} ${per.toFixed(2)} ms/frame  (${(1000 / per).toFixed(0)} fps)\n`);
}
