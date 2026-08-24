import type {
  ComponentDefinition,
  Disposable,
  LayerEntry,
  LayerPosition,
  SemanticVariant,
  TextUIApp,
} from '@textui/core';
import { CommandPalette } from './command-palette.js';
import { Dialog } from './dialog.js';
import { LayerScope } from './layer-scope.js';
import { PathPicker } from './path-picker.js';
import { PromptDialog } from './prompt-dialog.js';
import type { ToastHostProps } from './toast-host.js';
import { ToastHost } from './toast-host.js';
import { Toast } from './toast.js';
import { Tooltip } from './tooltip.js';

/**
 * Overlays.
 *
 * Every one of these is a layer entry, not a component that draws itself over
 * its neighbours - so focus trapping, dismissal and paint order are decided
 * once by the layer manager rather than five times, slightly differently.
 */
export * from './command-palette.js';
export * from './dialog.js';
export * from './layer-scope.js';
export * from './path-picker.js';
export * from './prompt-dialog.js';
export * from './toast.js';
export * from './toast-host.js';
export * from './tooltip.js';

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

/**
 * Picking a path by looking at it.
 *
 * The third question, beside `confirm` and `prompt`, and it exists because the
 * other two cannot ask it. A path typed blind into a text field is the worst
 * way to give one: you have to already know the answer, which is the opposite
 * of what picking is for.
 *
 * It reads the **resource registry**, never the filesystem. `search` made that
 * choice already and it is why search works on whatever is mounted; a picker
 * that reached for `node:fs` would work on `file:` and nothing else, and the
 * first thing anyone wants to pick off a remote is a file.
 */
export interface PickOptions {
  /** Where to start looking. A directory URI. */
  start: string;
  /** What counts as an answer. Directories are walked through either way. */
  wants?: 'file' | 'directory';
  title?: string;
  placeholder?: string;
  visibleRows?: number;
  width?: number;
}

export function pick(app: TextUIApp, options: PickOptions): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null): void => {
      if (settled) return;
      settled = true;
      handle.dispose();
      resolve(value);
    };

    const handle = app.layers.open({
      id: `pick:${options.start}`,
      layer: 'modal',
      scrim: true,
      trapFocus: true,
      dismissOnEscape: true,
      onClose: () => finish(null),
      node: {
        component: 'PathPicker',
        start: options.start,
        wants: options.wants ?? 'file',
        title: options.title,
        placeholder: options.placeholder,
        visibleRows: options.visibleRows,
        width: options.width,
        onPick: { handler: (uri: string) => finish(uri) },
        onCancel: { handler: () => finish(null) },
      },
    });
  });
}

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
  { component: 'PathPicker', category: 'overlay', renderer: { kind: 'function', render: PathPicker }, role: 'dialog', description: 'Walk the resource tree and pick a file or a folder.' },
  { component: 'Tooltip', category: 'overlay', renderer: { kind: 'function', render: Tooltip }, role: 'tooltip', description: 'Small anchored hint.' },
  { component: 'Toast', category: 'overlay', renderer: { kind: 'function', render: Toast }, role: 'status', description: 'Transient notification.' },
  { component: 'ToastHost', category: 'overlay', renderer: { kind: 'function', render: ToastHost }, description: 'Where toasts stack.' },
  { component: 'LayerScope', category: 'overlay', renderer: { kind: 'function', render: LayerScope }, description: 'The focus scope a layer lives in; makes `trapFocus` real.' },
  { component: 'CommandPalette', category: 'overlay', renderer: { kind: 'function', render: CommandPalette }, role: 'dialog', description: 'Fuzzy search over the command registry.' },
];
