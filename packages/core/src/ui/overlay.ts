import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { SemanticVariant } from '../types/style.js';
import type { LayerEntry, LayerPosition } from '../types/layer.js';
import type { ArgSpec, CommandDefinition } from '../types/command.js';
import type { TextUIApp } from '../types/app.js';
import type { Disposable } from '../types/disposable.js';
import { h, defineComponent } from '../jsx/factory.js';
import {
  useEffect, useFocusScope, useInput, useRuntime, useState, useTheme,
} from '../runtime/hooks.js';
import { Button, TextInput } from './control.js';
import { Menu, type MenuItem } from './navigation.js';

/**
 * Overlays.
 *
 * Every one of these is a layer entry, not a component that draws itself over
 * its neighbours - so focus trapping, dismissal and paint order are decided
 * once by the layer manager rather than five times, slightly differently.
 */

export interface DialogProps extends BoxProps {
  title?: string;
  /** Buttons along the bottom. The first is the default action. */
  actions?: { id: string; label: string; tone?: SemanticVariant; onPress?(): void }[];
  onClose?(): void;
  /** Cells wide. The dialog centres itself in whatever is left. */
  width?: number;
}

export const Dialog = defineComponent<DialogProps>('Dialog', (props) => {
  const theme = useTheme();
  const { title, actions = [], onClose, children, width = 50, ...rest } = props;

  useFocusScope({ trap: true, restore: true, autoFocus: true });

  // Only consume escape when there is something to do with it. Consuming it
  // regardless would stop the layer manager dismissing a dialog that was
  // opened without an `onClose` - which is most of them.
  useInput(
    (event) => {
      if (event.name !== 'escape' || !onClose) return false;
      onClose();
      return true;
    },
    { global: true },
  );

  return h('box', {
    role: 'dialog',
    label: title,
    border: theme.border,
    bg: 'overlay',
    padding: [0, 1],
    width,
    direction: 'column',
    title,
    ...rest,
  },
    h('box', { direction: 'column', flex: 1 }, children),
    actions.length > 0
      ? h('box', { direction: 'row', gap: 1, justify: 'end' },
          ...actions.map((action, i) =>
            h(Button, {
              key: action.id,
              label: action.label,
              tone: action.tone,
              // Every action is a line at rest; the focused one fills. Making
              // the default action solid as well meant two filled buttons the
              // moment focus moved, and no way to tell which one Enter meant.
              variant: 'outline',
              autoFocus: i === 0,
              onPress: action.onPress,
            })))
      : null,
  );
});

export interface TooltipProps extends BoxProps {
  text: string;
}

export const Tooltip = defineComponent<TooltipProps>('Tooltip', ({ text, ...rest }) => {
  const theme = useTheme();
  return h('box', {
    role: 'tooltip',
    border: theme.border,
    bg: 'overlay',
    padding: [0, 1],
    ...rest,
  }, h('text', { content: text }));
});

export interface ToastProps extends BoxProps {
  message: string;
  tone?: SemanticVariant;
  title?: string;
  icon?: string;
}

export const Toast = defineComponent<ToastProps>('Toast', (props) => {
  const theme = useTheme();
  const { message, tone = 'info', title, icon, ...rest } = props;
  const glyph = icon ?? {
    success: theme.glyphs.check,
    warning: theme.glyphs.warning,
    danger: theme.glyphs.cross,
    info: theme.glyphs.info,
  }[tone as 'success' | 'warning' | 'danger' | 'info'] ?? theme.glyphs.info;

  return h('box', {
    role: 'status',
    border: theme.border,
    bg: 'overlay',
    padding: [0, 1],
    direction: 'row',
    gap: 1,
    ...rest,
  },
    h('text', { content: glyph, fg: tone }),
    h('box', { direction: 'column' },
      title ? h('text', { content: title, bold: true }) : null,
      h('text', { content: message, wrap: 'word' })),
  );
});

export interface CommandPaletteProps extends BoxProps {
  /** Rows to search. Defaults to every enabled command in the `palette` slot. */
  commands?: CommandDefinition[];
  placeholder?: string;
  /** Notified after a command runs. The palette runs it itself. */
  onRun?(id: string, args?: Record<string, unknown>): void;
  onClose?(): void;
  /** Off makes this a picker: it reports the choice and runs nothing. */
  execute?: boolean;
  /** Group the list by `category`, with a rule between groups. */
  grouped?: boolean;
  visibleRows?: number;
  width?: number;
}

/**
 * The command palette.
 *
 * It searches the command registry rather than a list someone maintained, so
 * a command registered anywhere is reachable here the moment it exists - which
 * is the payoff for insisting actions are commands. It also *runs* what it
 * finds, so choosing "Open dialog" here and pressing the button that opens a
 * dialog are the same act, reaching the same code.
 *
 * A command that declares an argument with `choices` gets a second level:
 * choosing it lists the choices, and picking one runs the command with it.
 * That is where sub-items come from - the command says what it needs and the
 * palette asks, rather than every caller inventing its own submenu.
 */
export const CommandPalette = defineComponent<CommandPaletteProps>('CommandPalette', (props) => {
  const theme = useTheme();
  const runtime = useRuntime();
  const {
    commands, placeholder = 'Type a command…', onRun, onClose, execute = true,
    grouped = true, visibleRows = 8, width = 60, ...rest
  } = props;

  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  /** The command being asked about, when the palette has drilled in. */
  const [pending, setPending] = useState<{ command: CommandDefinition; arg: ArgSpec } | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  useFocusScope({ trap: true, restore: true, autoFocus: true });

  const app = runtime.app();
  const all = commands ?? app?.commands.list({ slot: 'palette', enabledOnly: true }) ?? [];

  const matches = pending ? [] : filterCommands(all, query);
  const rows = pending ? filterStrings(choices, query) : matches.map((c) => c.id);
  const index = Math.max(0, Math.min(highlight, rows.length - 1));

  const items: MenuItem[] = pending
    ? rows.map((choice) => ({
        id: choice,
        label: choice,
        description: pending.arg.default === choice ? 'default' : undefined,
      }))
    : matches.map((command, i) => ({
        id: command.id,
        label: command.title,
        description: command.category,
        icon: command.icon,
        shortcut: app?.keybindings.forCommand(command.id)[0],
        // A chevron, from `Menu`, for anything that will ask a question.
        children: argumentOf(command) ? [] : undefined,
        separatorBefore:
          grouped && i > 0 && (matches[i - 1] as CommandDefinition).category !== command.category,
      }));

  const back = (): void => {
    setPending(null);
    setChoices([]);
    setQuery('');
    setHighlight(0);
  };

  const finish = (id: string, args?: Record<string, unknown>): void => {
    // Close first: the command may open a layer of its own, and the palette
    // should be gone by the time it does rather than sitting underneath it.
    onClose?.();
    if (execute) void app?.execute(id, args, 'palette');
    onRun?.(id, args);
  };

  const choose = (): void => {
    if (pending) {
      const value = rows[index];
      if (value === undefined) return;
      finish(pending.command.id, { [pending.arg.name]: value });
      return;
    }

    const command = matches[index];
    if (!command) return;

    const arg = argumentOf(command);
    if (!arg) {
      finish(command.id);
      return;
    }

    // Ask. `choices` may be a function, and may be async.
    const resolved = typeof arg.choices === 'function' ? arg.choices() : arg.choices ?? [];
    setPending({ command, arg });
    setQuery('');
    setHighlight(0);
    if (Array.isArray(resolved)) setChoices(resolved);
    else void resolved.then((list) => setChoices(list));
  };

  // The field owns typing; the list owns up, down and enter. Without this
  // split, Enter submits the search box and the highlighted command is
  // never the thing that runs.
  useInput(
    (event) => {
      if (event.name === 'escape') {
        if (pending) back();
        else onClose?.();
        return true;
      }
      if (event.name === 'left' && pending && query === '') { back(); return true; }
      if (event.name === 'up') { setHighlight(Math.max(0, index - 1)); return true; }
      if (event.name === 'down') { setHighlight(Math.min(rows.length - 1, index + 1)); return true; }
      if (event.name === 'right' && !pending) {
        const command = matches[index];
        if (command && argumentOf(command)) { choose(); return true; }
      }
      return false;
    },
    { global: true },
  );

  const highlighted = pending ? undefined : matches[index];
  const detail = pending
    ? pending.arg.description ?? `${pending.command.title} needs a ${pending.arg.name}`
    : highlighted?.description ?? highlighted?.id ?? '';

  return h('box', {
    role: 'dialog',
    label: 'Commands',
    border: theme.border,
    bg: 'overlay',
    width,
    direction: 'column',
    title: pending ? ` commands ${theme.glyphs.breadcrumb} ${pending.arg.name} ` : ' commands ',
    ...rest,
  },
    h(TextInput, {
      value: query,
      onChange: (next: string) => {
        setQuery(next);
        setHighlight(0);
      },
      onSubmit: choose,
      placeholder: pending ? `Choose a ${pending.arg.name}…` : placeholder,
      search: true,
      autoFocus: true,
      border: 'none',
    }),
    h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }),
    h(Menu, {
      items,
      visibleRows,
      interactive: false,
      activeId: rows[index],
      onSelect: (id: string) => {
        const at = rows.indexOf(id);
        if (at >= 0) setHighlight(at);
        choose();
      },
    }),
    h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }),
    // What the highlighted row actually is, and how to move around. A palette
    // that shows only titles makes you run something to find out what it does.
    h('box', { direction: 'row', gap: 1 },
      h('text', { content: detail, fg: 'muted', flex: 1, truncate: 'end' }),
      h('text', { content: `${rows.length}`, fg: 'subtle' })),
    h('box', { direction: 'row', gap: 1 },
      h('text', {
        content: pending
          ? `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown} move · enter choose · esc back`
          : `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown} move · enter run · ${theme.glyphs.chevronRight} sub-items · esc close`,
        fg: 'subtle',
        truncate: 'end',
      })),
  );
});

/** The first argument a command declares choices for, if any. */
function argumentOf(command: CommandDefinition): ArgSpec | undefined {
  return (command.args ?? []).find((arg) => arg.choices !== undefined);
}

function filterStrings(values: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q === '') return values;
  return values.filter((value) => value.toLowerCase().includes(q));
}

export function filterCommands(commands: CommandDefinition[], query: string): CommandDefinition[] {
  const q = query.trim().toLowerCase();
  if (q === '') return commands;

  const scored: { command: CommandDefinition; score: number }[] = [];
  for (const command of commands) {
    const haystacks = [command.title, command.id, ...(command.keywords ?? [])];
    let best = -1;
    for (const haystack of haystacks) {
      const score = subsequenceScore(haystack.toLowerCase(), q);
      if (score > best) best = score;
    }
    if (best >= 0) scored.push({ command, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.command);
}

function subsequenceScore(haystack: string, needle: string): number {
  if (haystack.startsWith(needle)) return 1000 - haystack.length;
  if (haystack.includes(needle)) return 500 - haystack.indexOf(needle);

  let hi = 0;
  let score = 0;
  let streak = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, hi);
    if (found === -1) return -1;
    streak = found === hi ? streak + 1 : 0;
    score += 10 + streak * 5 - (found - hi);
    hi = found + 1;
  }
  return score;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: SemanticVariant;
}

/**
 * The composition rule the brief asks for: a dialog can be assembled by hand
 * out of public components, and the common case gets a one-liner that returns
 * a promise. Both go through the same layer manager.
 */
export function confirm(
  layers: { open(entry: LayerEntry): { dispose(): void } },
  options: ConfirmOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    const id = `confirm:${options.message}`;
    let settled = false;

    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      handle.dispose();
      resolve(value);
    };

    const handle = layers.open({
      id,
      layer: 'modal',
      scrim: true,
      trapFocus: true,
      dismissOnEscape: true,
      onClose: () => finish(false),
      node: {
        component: 'Dialog',
        title: options.title ?? 'Confirm',
        width: 50,
        children: { component: 'text', content: options.message, wrap: 'word' },
        actions: [
          {
            id: 'confirm',
            label: options.confirmLabel ?? 'Confirm',
            tone: options.tone ?? 'primary',
            onPress: () => finish(true),
          },
          {
            id: 'cancel',
            label: options.cancelLabel ?? 'Cancel',
            onPress: () => finish(false),
          },
        ],
      },
    });
  });
}

export interface PromptOptions {
  title?: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  mask?: string;
}

export function prompt(
  layers: { open(entry: LayerEntry): { dispose(): void } },
  options: PromptOptions,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null): void => {
      if (settled) return;
      settled = true;
      handle.dispose();
      resolve(value);
    };

    const handle = layers.open({
      id: `prompt:${options.title ?? options.message ?? 'input'}`,
      layer: 'modal',
      scrim: true,
      trapFocus: true,
      dismissOnEscape: true,
      onClose: () => finish(null),
      node: {
        component: 'PromptDialog',
        title: options.title ?? 'Input',
        message: options.message,
        placeholder: options.placeholder,
        initialValue: options.initialValue,
        mask: options.mask,
        onSubmit: { handler: (value: string) => finish(value) },
        onCancel: { handler: () => finish(null) },
      },
    });
  });
}

export interface PromptDialogProps extends BoxProps {
  title?: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  mask?: string;
  onSubmit?(value: string): void;
  onCancel?(): void;
}

export const PromptDialog = defineComponent<PromptDialogProps>('PromptDialog', (props) => {
  const { title, message, placeholder, initialValue = '', mask, onSubmit, onCancel, ...rest } = props;
  const [value, setValue] = useState(initialValue);

  return h(Dialog, {
    title,
    width: 50,
    onClose: onCancel,
    actions: [
      { id: 'ok', label: 'OK', tone: 'primary', onPress: () => onSubmit?.(value) },
      { id: 'cancel', label: 'Cancel', onPress: onCancel },
    ],
    ...rest,
  },
    message ? h('text', { content: message, wrap: 'word' }) : null,
    h(TextInput, {
      value,
      onChange: setValue,
      placeholder,
      mask,
      // The message names the field: an unlabelled input is a focus stop
      // nothing can describe, in the dialog whose whole job is one question.
      // It is already on screen above, so it is not drawn twice.
      label: message,
      hideLabel: true,
      autoFocus: true,
      onSubmit: () => onSubmit?.(value),
    }),
  );
});

export interface ToastHostProps extends BoxProps {
  /** Where the stack sits. Named `anchor` so it does not shadow `position`. */
  anchor?: 'top-right' | 'bottom-right' | 'top' | 'bottom';
}

/** Renders whatever is on the notification layer. */
export const ToastHost = defineComponent<ToastHostProps>('ToastHost', (props) => {
  const runtime = useRuntime();
  const { anchor = 'bottom-right', ...rest } = props;
  const entries = runtime.layers.entries('notification');

  useEffect(() => {
    // Re-render when the layer set changes; the manager already asks for a
    // frame, this only keeps the subscription honest.
  }, [entries.length]);

  if (entries.length === 0) return null;

  return h('box', {
    direction: 'column',
    gap: 1,
    align: anchor.endsWith('right') ? 'end' : 'stretch',
    ...rest,
  },
    ...entries.map((entry) => h('box', { key: entry.id }, entry.node)),
  );
});

export interface NotifyOptions {
  message: string;
  tone?: SemanticVariant;
  title?: string;
  icon?: string;
  /** Milliseconds on screen. 0 keeps it until it is closed. */
  timeoutMs?: number;
  /** Reuse an id to replace a standing toast rather than stack another. */
  id?: string;
}

let notifyCounter = 0;

/**
 * Raise a toast.
 *
 * Exists because the alternative - every caller assembling a layer entry - is
 * how two of them end up with different timeouts and one of them forgets the
 * `notification` layer and lands under the dialog it is reporting on.
 */
export function notify(app: TextUIApp, options: NotifyOptions): Disposable {
  const { message, tone = 'info', title, icon, timeoutMs = 2500, id } = options;
  return app.layers.open({
    id: id ?? `toast-${++notifyCounter}`,
    layer: 'notification',
    timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
    node: { component: 'Toast', message, tone, title, icon },
  });
}

export function toastPosition(anchor: ToastHostProps['anchor']): LayerPosition {
  switch (anchor) {
    case 'top': return { kind: 'screen', rect: { y: 1 } };
    case 'top-right': return { kind: 'screen', rect: { y: 1 } };
    case 'bottom': return { kind: 'screen', rect: { y: 0 } };
    default: return { kind: 'screen', rect: {} };
  }
}

export const OVERLAY_COMPONENTS: ComponentDefinition[] = [
  { component: 'Dialog', category: 'overlay', renderer: { kind: 'function', render: Dialog }, role: 'dialog', description: 'Modal box with actions; traps focus and restores it.' },
  { component: 'PromptDialog', category: 'overlay', renderer: { kind: 'function', render: PromptDialog }, role: 'dialog', description: 'One-field dialog behind the `prompt` helper.' },
  { component: 'Tooltip', category: 'overlay', renderer: { kind: 'function', render: Tooltip }, role: 'tooltip', description: 'Small anchored hint.' },
  { component: 'Toast', category: 'overlay', renderer: { kind: 'function', render: Toast }, role: 'status', description: 'Transient notification.' },
  { component: 'ToastHost', category: 'overlay', renderer: { kind: 'function', render: ToastHost }, description: 'Where toasts stack.' },
  { component: 'CommandPalette', category: 'overlay', renderer: { kind: 'function', render: CommandPalette }, role: 'dialog', description: 'Fuzzy search over the command registry.' },
];
