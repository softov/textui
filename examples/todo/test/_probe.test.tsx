import { describe, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerTodo } from '../src/app.js';
import { getTask } from '../src/data.js';

describe('probe', () => {
  it('drives it like a person', async () => {
    const t = await renderApp({
      width: 100, height: 26, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerTodo(app); },
    });
    for (let i = 0; i < 10; i++) await t.settle();

    t.tab(); await t.settle();
    console.log('focused (nav?):', t.app.focus.focused());
    t.press('down'); await t.settle();
    t.press('enter'); for (let i = 0; i < 4; i++) await t.settle();
    console.log('after nav down+enter, screen:', JSON.stringify(t.app.screens.current()));

    t.tab(); await t.settle();
    console.log('focused (list?):', t.app.focus.focused());
    t.press('down'); await t.settle();
    console.log('selected store:', t.app.store.get('$/todo/ui/selected'));
    t.press('space'); for (let i = 0; i < 4; i++) await t.settle();
    console.log('t1 state after space:', getTask(t.app.store, 't1')?.state, 't3:', getTask(t.app.store, 't3')?.state);
    t.press('n'); for (let i = 0; i < 4; i++) await t.settle();
    console.log('layers after n:', t.app.layers.entries().map((e) => e.id));
    console.log(t.lines().slice(0, 12).join('\n'));
    await t.unmount();
  });
});
