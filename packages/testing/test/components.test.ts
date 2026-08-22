import { describe, expect, it, vi } from 'vitest';
import { render, renderApp } from '../src/index.js';
import { h, Button, Column, Row, Field, Form, Progress, ScrollView, Select, TextArea, TextInput, defineComponent, useState, useForm, fieldValidators, validators } from '@textui/core';

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

/**
 * The select, open.
 *
 * Two things were wrong and both were about weight: the list was a second
 * bordered box below the first, so opening it drew two rules back to back and
 * the options read as a separate thing sitting nearby; and the highlighted
 * option was a filled row, which is the heaviest mark a list can make and the
 * only one that forces the text to invert to survive it.
 */
describe('Select', () => {
  const OPTIONS = [
    { value: 'eu-west-1', label: 'eu-west-1' },
    { value: 'us-east-1', label: 'us-east-1' },
    { value: 'sa-east-1', label: 'sa-east-1' },
  ];

  async function open() {
    return render(
      h(Select, { label: 'Region', value: 'us-east-1', open: true, options: OPTIONS }),
      { width: 40, height: 14 },
    );
  }

  it('holds the options inside its own border, with no second one', async () => {
    const t = await open();
    await t.settle();
    const drawn = t.lines().filter((l) => l.trim() !== '');

    // One top edge and one bottom edge for the whole control.
    expect(drawn.filter((l) => l.startsWith('┌')).length).toBe(1);
    expect(drawn.filter((l) => l.startsWith('└')).length).toBe(1);
    // And nothing blank between the value and the first option.
    const value = drawn.findIndex((l) => l.includes('us-east-1'));
    const first = drawn.findIndex((l) => l.includes('eu-west-1'));
    expect(first - value).toBe(2);
    await t.unmount();
  });

  it('marks the highlighted option with ink rather than a filled row', async () => {
    const t = await open();
    await t.settle();

    const lines = t.lines();
    const y = lines.findIndex((l) => l.includes('▸ us-east-1'));
    const plainY = lines.findIndex((l) => l.includes('  eu-west-1'));
    const active = t.app.buffer().get((lines[y] as string).indexOf('us-east-1'), y);
    const plain = t.app.buffer().get((lines[plainY] as string).indexOf('eu-west-1'), plainY);

    // Same background as the row above it: nothing was painted behind it.
    expect(active?.bg).toEqual(plain?.bg);
    // Accent, and underlined.
    expect(active?.fg).not.toEqual(plain?.fg);
    expect((active?.attrs ?? 0) & 8).toBe(8);
    await t.unmount();
  });
});

/**
 * A viewport that knows where its content ends.
 *
 * The layout has always recorded how far a scroll container can go - the
 * comment where it does says so - and nothing read it, so `scrollTo` clamped
 * at zero and nowhere else. Holding down an arrow walked the content off the
 * top of the view and left an empty box, with no way back but `home`.
 */
describe('ScrollView', () => {
  function lines(count: number) {
    return h(Column, {}, ...Array.from({ length: count }, (_, i) =>
      h('text', { key: i, content: `line ${i + 1}` })));
  }

  async function open(count: number, height = 8) {
    const t = await render(h(ScrollView, { flex: 1 }, lines(count)), { width: 24, height });
    await t.settle();
    t.focus(t.app.focus.order('__global__')[0] as string);
    return t;
  }

  it('stops with the last line at the bottom', async () => {
    const t = await open(20);
    for (let i = 0; i < 60; i++) { t.press('down'); await t.settle(); }

    // Eight rows of viewport, so the last screen is lines 13 to 20 - not a
    // blank box below line 20, which is where it used to end up.
    expect(t.lines()[0]).toContain('line 13');
    expect(t.lines()[7]).toContain('line 20');
    await t.unmount();
  });

  it('comes back to the top and stops there', async () => {
    const t = await open(20);
    for (let i = 0; i < 30; i++) { t.press('down'); await t.settle(); }
    for (let i = 0; i < 60; i++) { t.press('up'); await t.settle(); }

    expect(t.lines()[0]).toContain('line 1');
    await t.unmount();
  });

  it('does not move at all when everything already fits', async () => {
    const t = await open(4);
    const before = t.lines();
    for (let i = 0; i < 10; i++) { t.press('down'); await t.settle(); }

    expect(t.lines()).toEqual(before);
    await t.unmount();
  });

  it('re-clamps when the terminal gets taller', async () => {
    const t = await open(20);
    for (let i = 0; i < 60; i++) { t.press('down'); await t.settle(); }
    expect(t.lines()[0]).toContain('line 13');

    // More room means less to scroll, and an offset from before must not
    // leave the content hanging above the top of a now-taller view.
    await t.resize(24, 16);
    await t.settle();
    expect(t.lines()[0]).toContain('line 5');
    expect(t.lines()[15]).toContain('line 20');
    await t.unmount();
  });
});

/**
 * Labels, on the line of the thing they name.
 *
 * A row stretches its children, so a one-row label beside a three-row bordered
 * input was drawn level with the border - one row above the text it labels.
 * Borderless controls are one row and looked right, so a form mixing the two
 * had half its labels aligned and half of them a row high.
 */
describe('Field alignment', () => {
  const Subject = defineComponent<Record<string, never>>('Subject', () => {
    const [value, setValue] = useState('typed');
    const form = useForm({ initialValues: { name: '' }, onSubmit: () => {} });
    return h(Form, { form },
      h(Field, { name: 'name', label: 'Name', labelWidth: 12 },
        h(TextInput, { value, onChange: setValue })));
  });

  it('puts the label on the input\'s line of text', async () => {
    const t = await render(h(Subject, {}), { width: 46, height: 6 });
    await t.settle();

    const labelRow = t.lines().findIndex((l) => l.includes('Name'));
    const textRow = t.lines().findIndex((l) => l.includes('typed'));
    expect(labelRow).toBe(textRow);
    await t.unmount();
  });

  it('leaves a borderless control where it already was', async () => {
    const Flat = defineComponent<Record<string, never>>('Flat', () => {
      const form = useForm({ initialValues: { n: '' }, onSubmit: () => {} });
      return h(Form, { form },
        h(Field, { name: 'n', label: 'Notify', labelWidth: 12 },
          h('text', { content: '[on]' })));
    });
    const t = await render(h(Flat, {}), { width: 40, height: 4 });
    await t.settle();

    const labelRow = t.lines().findIndex((l) => l.includes('Notify'));
    expect(t.lines()[labelRow]).toContain('[on]');
    await t.unmount();
  });
});

/**
 * A stack of bars starts at one column.
 *
 * Labels are their own width otherwise, which is right for one bar and wrong
 * for three - each pushes its track somewhere different and the group reads as
 * three unrelated widgets.
 */
describe('Progress labelWidth', () => {
  it('starts every track at the same column', async () => {
    const t = await render(
      h(Column, {},
        h(Progress, { label: 'download', value: 0.35, labelWidth: 9 }),
        h(Progress, { label: 'index', value: 0.82, labelWidth: 9 })),
      { width: 44, height: 4 },
    );
    await t.settle();

    const bars = t.lines()
      .filter((l) => l.trim() !== '')
      .map((l) => l.search(/[█░]/));
    expect(bars.length).toBe(2);
    expect(bars[0]).toBe(bars[1]);
    await t.unmount();
  });

  it('lets each label be its own width when nothing says otherwise', async () => {
    const t = await render(
      h(Column, {},
        h(Progress, { label: 'download', value: 0.35 }),
        h(Progress, { label: 'index', value: 0.82 })),
      { width: 44, height: 4 },
    );
    await t.settle();

    const bars = t.lines()
      .filter((l) => l.trim() !== '')
      .map((l) => l.search(/[█░]/));
    expect(bars[0]).not.toBe(bars[1]);
    await t.unmount();
  });
});

/**
 * The three a chat application needed and the catalog did not have.
 *
 * Each is here for the behaviour that makes it not a composition of what was
 * already shipped: a field that keeps the keys it is typing, a viewport over
 * entries whose height it had to measure, and markdown that survives being
 * wrapped.
 */

describe('TextArea', () => {
  it('takes a printable character before any keybinding does', async () => {
    // The reason an application with a composer can have single-letter
    // commands at all: while this has focus, `q` is a letter.
    const ran: string[] = [];
    const t = await renderApp({
      width: 40,
      height: 8,
      onBoot: (app) => {
        app.commands.register({ id: 'demo.quit', title: 'Quit', run: () => ran.push('quit') });
        app.keybindings.register({ keys: 'q', commandId: 'demo.quit' });
      },
      root: h(function Host() {
        const [value, setValue] = useState('');
        return h(TextArea, { value, onChange: setValue, focusId: 'field', autoFocus: true, placeholder: 'type' });
      }, {}),
    });
    await t.settle();

    t.focus('field');
    t.type('quiet');
    await t.settle();

    expect(ran).toEqual([]);
    expect(t.hasText('quiet')).toBe(true);
    await t.unmount();
  });

  it('grows to the lines typed, then stops and scrolls', async () => {
    const t = await render(
      { component: 'TextArea', value: 'one\ntwo\nthree\nfour\nfive', onChange: { handler: () => {} }, maxRows: 3 },
      { width: 30, height: 10 },
    );
    // Three rows, not five: a field that grows without limit eventually leaves
    // no room for what it is a reply to.
    expect(t.getByRole('textbox').rect?.height).toBe(3);
    await t.unmount();
  });

  it('gives enter to the caller and keeps alt+enter for itself', async () => {
    const sent: string[] = [];
    const t = await renderApp({
      width: 40,
      height: 8,
      root: h(function Host() {
        const [value, setValue] = useState('');
        return h(TextArea, {
          value,
          onChange: setValue,
          onSubmit: (text: string) => sent.push(text),
          focusId: 'field',
          autoFocus: true,
        });
      }, {}),
    });
    await t.settle();
    t.focus('field');

    t.type('one');
    t.press('alt+enter');
    t.type('two');
    await t.settle();
    expect(sent).toEqual([]);

    t.press('enter');
    await t.settle();
    expect(sent).toEqual(['one\ntwo']);
    await t.unmount();
  });
});

describe('Feed', () => {
  const entries = (n: number): unknown[] =>
    Array.from({ length: n }, (_, i) => h('text', { key: i, content: `entry ${i}` }));

  it('follows the tail, and stops when the reader scrolls up', async () => {
    const t = await render(
      { component: 'Feed', focusId: 'feed', children: entries(40), height: 6 },
      { width: 30, height: 8 },
    );
    for (let i = 0; i < 4; i++) await t.settle();
    // Opens at the end, which is where a feed is read from.
    expect(t.hasText('entry 39')).toBe(true);

    t.focus('feed');
    t.press('pageup');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('entry 39')).toBe(false);

    t.press('end');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('entry 39')).toBe(true);
    await t.unmount();
  });

  it('moves a cursor between entries when the caller owns one', async () => {
    const selected: number[] = [];
    const t = await render(
      {
        component: 'Feed',
        focusId: 'feed',
        selectedIndex: 0,
        onSelect: { handler: (index: number) => selected.push(index) },
        children: entries(5),
        height: 6,
      },
      { width: 30, height: 8 },
    );
    await t.settle();
    t.focus('feed');
    t.press('down');
    t.press('down');
    expect(selected).toEqual([1, 1]);
    await t.unmount();
  });

  it('draws no scrollbar when everything fits', async () => {
    // A track down the side of a feed that fits states something untrue.
    const short = await render(
      { component: 'Feed', children: entries(2), height: 6 },
      { width: 30, height: 8 },
    );
    for (let i = 0; i < 4; i++) await short.settle();
    const narrow = short.lines().some((line) => line.trimEnd().length >= 29);
    expect(narrow).toBe(false);
    await short.unmount();
  });
});

describe('MarkdownView', () => {
  it('keeps emphasis and code through the wrap', async () => {
    const t = await render(
      { component: 'MarkdownView', content: 'the **composer** owns `enter` here' },
      { width: 24, height: 8 },
    );
    await t.settle();
    // The markers are gone and the words are not: a viewer that stripped both
    // would pass a text assertion and lose the meaning.
    expect(t.hasText('composer')).toBe(true);
    expect(t.text()).not.toContain('**');
    await t.unmount();
  });

  it('collapses past maxLines and says how much is hidden', async () => {
    const t = await render(
      { component: 'MarkdownView', content: 'one\ntwo\nthree\nfour\nfive', maxLines: 2 },
      { width: 24, height: 8 },
    );
    await t.settle();
    expect(t.hasText('more lines')).toBe(true);
    await t.unmount();
  });
});

describe('the tab order', () => {
  it('keeps a control in place when it stops being disabled', async () => {
    // A Submit that is disabled until a field is filled in used to re-register
    // the moment it became usable, and a registration made again goes on the
    // end - so tab from the field reached Cancel first, which is the one
    // control the reader was not going towards.
    const t = await renderApp({
      width: 40,
      height: 10,
      root: h(function Host() {
        const [value, setValue] = useState('');
        return h(Column, { gap: 1 },
          h(TextInput, { value, onChange: setValue, label: 'name', focusId: 'field', autoFocus: true }),
          h(Button, { label: 'Save', disabled: value === '', onPress: () => {} }),
          h(Button, { label: 'Cancel', onPress: () => {} }));
      }, {}),
    });
    await t.settle();

    t.focus('field');
    t.type('anything');
    await t.settle();

    t.tab();
    await t.settle();
    expect(t.focused()?.label).toBe('Save');
    await t.unmount();
  });

  it('moves focus off a control that becomes disabled', async () => {
    const t = await renderApp({
      width: 40,
      height: 10,
      root: h(function Host() {
        const [value, setValue] = useState('x');
        return h(Column, { gap: 1 },
          h(TextInput, { value, onChange: setValue, label: 'name', focusId: 'field' }),
          h(Button, { label: 'Save', disabled: value === '', onPress: () => {} }));
      }, {}),
    });
    await t.settle();

    const save = t.getByRole('button', { name: 'Save' }).id;
    t.focus(save);
    await t.settle();
    expect(t.app.focus.focused()).toBe(save);

    // Emptying the field disables Save. Focus cannot stay there: the keys it
    // would have handled are now nobody's.
    t.focus('field');
    t.press('backspace');
    for (let i = 0; i < 3; i++) await t.settle();
    expect(t.app.focus.focused()).not.toBe(save);
    await t.unmount();
  });
});

/**
 * Three weights of button.
 *
 * A solid button used to fill its ring cells at every size, so it was a solid
 * rectangle standing beside an outline button that was a thin frame - same
 * height, twice the weight, and a row of them looked bigger than the row
 * above. `md` draws the ring in half-blocks instead: same height, same
 * measure, and it no longer out-weighs its neighbour. `lg` is the old look,
 * asked for on purpose.
 */
describe('Button size', () => {
  const solid = (size?: 'sm' | 'md' | 'lg') =>
    h(Button, { label: 'Go', tone: 'primary', variant: 'solid', ...(size ? { size } : {}) });

  /**
   * How tall the button is, by where it put ink.
   *
   * Not by counting non-blank lines: `lg` fills its edge rows with the tone
   * and draws spaces on them, so a text-only measure reports a three-row
   * button as one row and the difference between the sizes disappears.
   */
  async function height(node: unknown, theme?: string) {
    const t = await render(node as never, { width: 20, height: 6, ...(theme ? { theme } : {}) });
    await t.settle();
    // The canvas is painted too, so "has a background" is every cell. What
    // marks the button is a background that differs from the backdrop.
    const backdrop = JSON.stringify(t.app.buffer().get(19, 5)?.bg);
    const painted = new Set<number>();
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 20; x++) {
        const cell = t.app.buffer().get(x, y);
        if (!cell) continue;
        if (cell.char.trim() !== '' || JSON.stringify(cell.bg) !== backdrop) painted.add(y);
      }
    }
    await t.unmount();
    return painted.size;
  }

  it('is one row small and three rows otherwise', async () => {
    expect(await height(solid('sm'))).toBe(1);
    expect(await height(solid())).toBe(3);
    expect(await height(solid('lg'))).toBe(3);
  });

  it('draws the medium edge as glyphs and the large edge as fill', async () => {
    const edge = async (size: 'md' | 'lg') => {
      const t = await render(solid(size), { width: 20, height: 6 });
      await t.settle();
      const top = t.lines()[0] as string;
      await t.unmount();
      return top;
    };
    // Half-blocks: the ring is visible ink, and half a cell high.
    expect((await edge('md')).trim()).not.toBe('');
    // Filled through: the edge row is the tone, with nothing drawn on it.
    expect((await edge('lg')).trim()).toBe('');
  });

  it('fills at every size, focused or not', async () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const t = await render(solid(size), { width: 20, height: 6 });
      await t.settle();
      const y = t.lines().findIndex((l) => l.includes('Go'));
      const cell = t.app.buffer().get((t.lines()[y] as string).indexOf('Go'), y);
      // Against the backdrop, not merely "defined": every cell carries the
      // canvas colour, so `toBeDefined` here would pass on an empty screen.
      expect(cell?.bg, `${size} should be filled`).not.toEqual(t.app.buffer().get(19, 5)?.bg);
      await t.unmount();
    }
  });

  it('stands the same height as the outline button beside it', async () => {
    const t = await render(
      h(Row, { gap: 1 }, solid(), h(Button, { label: 'Or' })),
      { width: 24, height: 6 },
    );
    await t.settle();
    // Both occupy the same three rows: a dialog's OK does not sit a line
    // above its Cancel.
    const filled = t.lines().findIndex((l) => l.includes('Go'));
    const outlined = t.lines().findIndex((l) => l.includes('Or'));
    expect(filled).toBe(outlined);
    await t.unmount();
  });

  it('collapses to one row on a theme that draws no border', async () => {
    // `paper` draws no frame, so there is no ring to reserve and every size
    // is the one-row button - which is the right answer, not a special case.
    expect(await height(solid(), 'paper')).toBe(1);
  });
});
