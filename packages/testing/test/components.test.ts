import { describe, expect, it, vi } from 'vitest';
import { render, renderApp } from '../src/index.js';
import { h, defineComponent, useState, useForm, fieldValidators, validators } from '@textui/core';

const ROWS = [
  { id: 'api', name: 'api-gateway', status: 'up', cpu: '12.4', mem: '310' },
  { id: 'auth', name: 'auth-service', status: 'up', cpu: '3.1', mem: '96' },
  { id: 'billing', name: 'billing-worker', status: 'degraded', cpu: '48.9', mem: '1229' },
];

describe('List', () => {
  const items = ROWS.map((r) => ({ id: r.id, label: r.name }));

  it('renders every item', async () => {
    const t = await render({ component: 'List', items }, { width: 40, height: 8 });
    expect(t.getAllByRole('listitem')).toHaveLength(3);
    await t.unmount();
  });

  it('moves the selection with the arrow keys', async () => {
    const selected: string[] = [];
    const t = await render(
      { component: 'List', items, onSelect: { handler: (id: string) => selected.push(id) }, autoFocus: true },
      { width: 40, height: 8 },
    );
    t.focus(t.getByRole('list').id);
    t.press('down');
    t.press('down');
    expect(selected).toEqual(['auth', 'billing']);
    await t.unmount();
  });

  it('activates with enter', async () => {
    const activated: string[] = [];
    const t = await render(
      { component: 'List', items, onActivate: { handler: (id: string) => activated.push(id) } },
      { width: 40, height: 8 },
    );
    t.focus(t.getByRole('list').id);
    t.press('enter');
    expect(activated).toEqual(['api']);
    await t.unmount();
  });

  it('shows an empty state', async () => {
    const t = await render(
      { component: 'List', items: [], emptyMessage: 'No services' },
      { width: 40, height: 6 },
    );
    expect(t.hasText('No services')).toBe(true);
    await t.unmount();
  });

  it('windows a long list to the visible rows', async () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, label: `service-${i}` }));
    const t = await render(
      { component: 'List', items: many, visibleRows: 5 },
      { width: 40, height: 8 },
    );
    expect(t.getAllByRole('listitem')).toHaveLength(5);
    await t.unmount();
  });
});

describe('Table', () => {
  const columns = [
    { key: 'name', header: 'NAME', width: 16 },
    { key: 'status', header: 'STATUS', width: 9, priority: 5 },
    { key: 'cpu', header: 'CPU', width: 6, align: 'right', priority: 1 },
    { key: 'mem', header: 'MEM', width: 6, align: 'right', priority: 0 },
  ];

  it('renders headers and rows', async () => {
    const t = await render({ component: 'Table', columns, rows: ROWS }, { width: 60, height: 8 });
    expect(t.hasText('NAME')).toBe(true);
    expect(t.hasText('api-gateway')).toBe(true);
    expect(t.getAllByRole('row')).toHaveLength(4); // header plus three
    await t.unmount();
  });

  it('drops the lowest-priority column when it does not fit', async () => {
    const wide = await render(
      { component: 'Table', columns, rows: ROWS, width: 60 },
      { width: 60, height: 8 },
    );
    expect(wide.hasText('MEM')).toBe(true);
    await wide.unmount();

    const narrow = await render(
      { component: 'Table', columns, rows: ROWS, width: 30 },
      { width: 30, height: 8 },
    );
    expect(narrow.hasText('NAME')).toBe(true);
    expect(narrow.hasText('MEM')).toBe(false);
    await narrow.unmount();
  });

  it('formats a cell through its column', async () => {
    const t = await render(
      {
        component: 'Table',
        columns: [{ key: 'cpu', header: 'CPU', width: 8, format: (v: unknown) => `${v}%` }],
        rows: ROWS,
      },
      { width: 30, height: 8 },
    );
    expect(t.hasText('12.4%')).toBe(true);
    await t.unmount();
  });

  it('selects rows with the keyboard', async () => {
    const selected: string[] = [];
    const t = await render(
      { component: 'Table', columns, rows: ROWS, onSelect: { handler: (key: string) => selected.push(key) } },
      { width: 60, height: 8 },
    );
    t.focus(t.getByRole('table').id);
    t.press('down');
    t.press('end');
    expect(selected).toEqual(['auth', 'billing']);
    await t.unmount();
  });
});

describe('Tree', () => {
  const nodes = [
    {
      id: 'prod',
      label: 'production',
      children: [
        { id: 'prod/api', label: 'api-gateway' },
        { id: 'prod/billing', label: 'billing-worker' },
      ],
    },
    { id: 'staging', label: 'staging', children: [{ id: 'staging/api', label: 'api-gateway' }] },
  ];

  it('shows only the roots when nothing is expanded', async () => {
    const t = await render({ component: 'Tree', nodes }, { width: 40, height: 10 });
    expect(t.hasText('production')).toBe(true);
    expect(t.hasText('billing-worker')).toBe(false);
    await t.unmount();
  });

  it('expands with the right arrow', async () => {
    const t = await render({ component: 'Tree', nodes }, { width: 40, height: 10 });
    t.focus(t.getByRole('tree').id);
    t.press('right');
    expect(t.hasText('billing-worker')).toBe(true);
    await t.unmount();
  });

  it('collapses with the left arrow', async () => {
    const t = await render({ component: 'Tree', nodes }, { width: 40, height: 10 });
    t.focus(t.getByRole('tree').id);
    t.press('right');
    t.press('left');
    expect(t.hasText('billing-worker')).toBe(false);
    await t.unmount();
  });

  it('walks into the children once expanded', async () => {
    const t = await render({ component: 'Tree', nodes }, { width: 40, height: 10 });
    t.focus(t.getByRole('tree').id);
    t.press('right');
    t.press('right');
    expect(t.getAllByRole('treeitem').length).toBeGreaterThan(2);
    await t.unmount();
  });
});

describe('LogViewer', () => {
  const lines = Array.from({ length: 40 }, (_, i) => ({
    time: `10:0${i % 10}`,
    level: (['info', 'warn', 'error'] as const)[i % 3],
    message: `line ${i}`,
  }));

  it('follows the tail by default', async () => {
    const t = await render(
      { component: 'LogViewer', lines, visibleRows: 5 },
      { width: 60, height: 8 },
    );
    expect(t.hasText('line 39')).toBe(true);
    expect(t.hasText('line 0')).toBe(false);
    await t.unmount();
  });

  it('stops following once the reader scrolls up', async () => {
    const t = await render(
      { component: 'LogViewer', lines, visibleRows: 5 },
      { width: 60, height: 8 },
    );
    t.focus(t.getByRole('log').id);
    t.press('pageup');
    expect(t.hasText('paused')).toBe(true);
    await t.unmount();
  });

  it('follows again after end', async () => {
    const t = await render(
      { component: 'LogViewer', lines, visibleRows: 5 },
      { width: 60, height: 8 },
    );
    t.focus(t.getByRole('log').id);
    t.press('pageup');
    t.press('end');
    expect(t.hasText('paused')).toBe(false);
    expect(t.hasText('line 39')).toBe(true);
    await t.unmount();
  });
});

describe('charts', () => {
  it('renders a sparkline one row tall', async () => {
    const t = await render(
      { component: 'Sparkline', values: [1, 5, 3, 9, 2], chartWidth: 5 },
      { width: 20, height: 1 },
    );
    expect(t.line(0).length).toBe(5);
    await t.unmount();
  });

  it('scales a bar chart to its widest value', async () => {
    const t = await render(
      {
        component: 'BarChart',
        data: [{ label: 'a', value: 10 }, { label: 'b', value: 5 }],
        barWidth: 10,
        showValue: false,
      },
      { width: 30, height: 3 },
    );
    const [first, second] = t.lines();
    expect((first ?? '').length).toBeGreaterThan((second ?? '').length);
    await t.unmount();
  });

  it('colours a gauge by threshold and states the number', async () => {
    const t = await render(
      {
        component: 'Gauge',
        value: 91,
        label: 'cpu',
        thresholds: [{ at: 80, tone: 'danger' }, { at: 50, tone: 'warning' }],
      },
      { width: 40, height: 1 },
    );
    expect(t.hasText('91%')).toBe(true);
    await t.unmount();
  });

  it('draws a heatmap row per data row', async () => {
    const t = await render(
      { component: 'Heatmap', data: [[1, 2, 3], [3, 2, 1]] },
      { width: 20, height: 2 },
    );
    expect(t.lines().filter((l) => l.trim() !== '')).toHaveLength(2);
    await t.unmount();
  });

  it('falls back to blocks when braille is unavailable', async () => {
    const t = await render(
      { component: 'LineChart', series: [{ values: [1, 4, 2, 8] }], chartHeight: 4, axis: false },
      { width: 20, height: 4, capabilities: { unicode: 'ascii' } },
    );
    expect(t.text().trim().length).toBeGreaterThan(0);
    await t.unmount();
  });
});

describe('forms', () => {
  const LoginForm = defineComponent('LoginForm', () => {
    const form = useForm({
      initialValues: { user: '', password: '' },
      validate: fieldValidators({
        user: [validators.required('User is required')],
        password: [validators.minLength(8, 'At least 8 characters')],
      }),
      onSubmit: () => {},
    });

    return h('Form', { form },
      h('Field', { name: 'user', label: 'User', labelWidth: 10 },
        h('TextInput', {
          value: form.values.user,
          onChange: (v: string) => { form.setValue('user', v); form.touch('user'); },
          autoFocus: true,
        })),
      h('Field', { name: 'password', label: 'Password', labelWidth: 10 },
        h('TextInput', {
          value: form.values.password,
          mask: '*',
          onChange: (v: string) => { form.setValue('password', v); form.touch('password'); },
        })),
      h('text', { content: `valid=${form.valid}` }),
      h('FormActions', {}),
    );
  });

  it('does not show errors before a field is touched', async () => {
    const t = await render(h(LoginForm, {}), { width: 50, height: 14 });
    expect(t.hasText('User is required')).toBe(false);
    await t.unmount();
  });

  it('shows an error once the field is touched and invalid', async () => {
    const t = await render(h(LoginForm, {}), { width: 50, height: 14 });
    t.type('x');
    t.press('backspace');
    expect(t.hasText('User is required')).toBe(true);
    await t.unmount();
  });

  it('clears the error when the value becomes valid', async () => {
    const t = await render(h(LoginForm, {}), { width: 50, height: 14 });
    t.type('x');
    t.press('backspace');
    expect(t.hasText('User is required')).toBe(true);
    t.type('softov');
    expect(t.hasText('User is required')).toBe(false);
    await t.unmount();
  });

  it('reports validity across fields', async () => {
    const t = await render(h(LoginForm, {}), { width: 50, height: 14 });
    expect(t.hasText('valid=false')).toBe(true);
    await t.unmount();
  });

  it('masks a secret field', async () => {
    const t = await render(h(LoginForm, {}), { width: 50, height: 14 });
    t.tab();
    t.type('hunter2');
    expect(t.hasText('hunter2')).toBe(false);
    expect(t.hasText('*******')).toBe(true);
    await t.unmount();
  });
});

describe('controls', () => {
  it('toggles a checkbox with space', async () => {
    const Toggle = defineComponent('Toggle', () => {
      const [on, setOn] = useState(false);
      return h('box', { direction: 'column' },
        h('Checkbox', { label: 'follow', checked: on, onChange: setOn, autoFocus: true }),
        h('text', { content: `on=${on}` }));
    });

    const t = await render(h(Toggle, {}), { width: 30, height: 4 });
    t.focus(t.getByRole('checkbox').id);
    t.press('space');
    expect(t.hasText('on=true')).toBe(true);
    await t.unmount();
  });

  it('moves a slider with the arrow keys', async () => {
    const Level = defineComponent('Level', () => {
      const [value, setValue] = useState(50);
      return h('box', { direction: 'column' },
        h('Slider', { value, onChange: setValue, label: 'level', step: 5 }),
        h('text', { content: `v=${value}` }));
    });

    const t = await render(h(Level, {}), { width: 40, height: 4 });
    t.focus(t.getByRole('slider').id);
    t.press('right');
    t.press('right');
    expect(t.hasText('v=60')).toBe(true);
    await t.unmount();
  });

  it('opens a select and chooses an option', async () => {
    const Pick = defineComponent('Pick', () => {
      const [value, setValue] = useState<string | undefined>(undefined);
      return h('box', { direction: 'column' },
        h('Select', {
          options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }],
          value,
          onChange: setValue,
        }),
        h('text', { content: `v=${value ?? '-'}` }));
    });

    const t = await render(h(Pick, {}), { width: 40, height: 10 });
    t.focus(t.getByRole('combobox').id);
    t.press('enter');
    expect(t.hasText('Alpha')).toBe(true);
    expect(t.hasText('Beta')).toBe(true);

    t.press('down');
    t.press('enter');
    expect(t.hasText('v=b')).toBe(true);
    await t.unmount();
  });

  it('does not act on a disabled control', async () => {
    const onPress = vi.fn();
    const t = await render(
      { component: 'Button', label: 'Go', disabled: true, onPress: { handler: onPress } },
      { width: 20, height: 3 },
    );
    t.clickOn(t.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    await t.unmount();
  });
});

describe('layers', () => {
  it('opens a dialog over the base layer', async () => {
    const t = await renderApp({ width: 60, height: 16, shell: 'plain' });
    t.app.open({ surface: 'main', key: 'body', target: { component: 'text', content: 'behind' } });
    t.flush();
    expect(t.hasText('behind')).toBe(true);

    t.app.layers.open({
      id: 'confirm',
      layer: 'modal',
      scrim: true,
      trapFocus: true,
      node: { component: 'Dialog', title: 'Restart?', width: 30, children: { component: 'text', content: 'Are you sure' } },
    });
    t.flush();
    expect(t.hasText('Are you sure')).toBe(true);
    await t.unmount();
  });

  it('closes the topmost layer on escape', async () => {
    const t = await renderApp({ width: 60, height: 16, shell: 'plain' });
    t.app.layers.open({
      id: 'd',
      layer: 'modal',
      dismissOnEscape: true,
      node: { component: 'Dialog', title: 'Hi', width: 24, children: { component: 'text', content: 'dialog body' } },
    });
    t.flush();
    expect(t.hasText('dialog body')).toBe(true);

    t.press('escape');
    expect(t.hasText('dialog body')).toBe(false);
    await t.unmount();
  });

  it('reports the topmost focus trap', async () => {
    const t = await renderApp({ width: 40, height: 10 });
    t.app.layers.open({ id: 'a', layer: 'floating', node: { component: 'text', content: 'a' } });
    t.app.layers.open({ id: 'b', layer: 'modal', trapFocus: true, node: { component: 'text', content: 'b' } });
    expect(t.app.layers.topmostTrap()?.id).toBe('b');
    await t.unmount();
  });

  it('paints modal above floating', async () => {
    const t = await renderApp({ width: 40, height: 10 });
    t.app.layers.open({ id: 'a', layer: 'modal', node: { component: 'text', content: 'modal' } });
    t.app.layers.open({ id: 'b', layer: 'floating', node: { component: 'text', content: 'floating' } });
    const order = t.app.layers.entries().map((e) => e.id);
    expect(order).toEqual(['b', 'a']);
    await t.unmount();
  });
});

/**
 * A list with headings in it.
 *
 * A grouped list is a list whose group titles are rows nobody can select.
 * Stopping at one instead of stepping over it turns the heading into a wall,
 * and the list below it into somewhere the keyboard cannot reach.
 */
describe('a list with unselectable rows', () => {
  const ITEMS = [
    { id: 'h1', label: 'Inbox', disabled: true },
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'h2', label: 'Projects', disabled: true },
    { id: 'advisor', label: 'Advisor' },
  ];

  const list = async () => {
    const chosen: string[] = [];
    const t = await render(
      h('List', {
        items: ITEMS,
        autoFocus: true,
        onSelect: { handler: (id: string) => chosen.push(id) },
      }),
      { width: 30, height: 8 },
    );
    await t.settle();
    t.focus(t.getByRole('list').id);
    return { t, chosen };
  };

  it('starts on the first row somebody can choose', async () => {
    const { t } = await list();
    // Not the heading above it.
    expect(t.getByRole('listitem', { name: 'All' }).props.selected).toBe(true);
    await t.unmount();
  });

  it('steps over a heading rather than stopping at it', async () => {
    const { t, chosen } = await list();
    t.press('down');
    await t.settle();
    t.press('down');
    await t.settle();

    // All -> Today -> (Projects is a heading) -> Advisor
    expect(chosen).toEqual(['today', 'advisor']);
    await t.unmount();
  });

  it('goes back past one too, and lands on something real at each end', async () => {
    const { t, chosen } = await list();
    t.press('end');
    await t.settle();
    t.press('up');
    await t.settle();
    t.press('home');
    await t.settle();

    expect(chosen).toEqual(['advisor', 'today', 'all']);
    await t.unmount();
  });
});
