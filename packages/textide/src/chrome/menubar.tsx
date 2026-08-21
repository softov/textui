import { Row, defineComponent, useCommand, useFocus, useInput, useRuntime, useState } from '@textui/core';
import type { KeyEvent, MenuItem, RenderOutput, TextUIApp } from '@textui/core';

/**
 * The menu bar.
 *
 * Every item is a command id and nothing else. The bar knows the shape of the
 * menus and none of what they do, so a command that gains a keybinding shows
 * it here without this file changing, and one that is disabled is greyed here
 * for the same reason it is greyed everywhere - both facts come from the
 * registry rather than a copy kept beside it.
 *
 * The dropdown is a layer anchored under its label, so it overlaps the screen
 * instead of pushing it down. A menu that reflows the editor is a menu that
 * moves the thing you were about to click.
 */

interface MenuSpec {
  id: string;
  label: string;
  /** Command ids; `null` is a separator. */
  items: (string | null)[];
}

export const MENUS: MenuSpec[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      'fs.newFile', 'fs.newFolder', null,
      'file.save', 'file.revert', 'file.close', null,
      'fs.rename', 'fs.delete', null,
      'app.quit',
    ],
  },
  {
    id: 'view',
    label: 'View',
    // Layout owns the switches. One entry that opens the list beats one line
    // per hideable part, and the list then grows with the shell instead of
    // with this array.
    items: ['view.theme', 'view.layout', null, 'app.palette'],
  },
  { id: 'help', label: 'Help', items: ['help.keys', 'help.about'] },
];

const DROPDOWN = 'menubar.dropdown';
const DROPDOWN_PANEL = 'menubar.dropdown.panel';

/** The choices an argument offers, whether it states them or computes them. */
function choicesOf(command: { args?: readonly { name: string; choices?: unknown }[] }):
  { name: string; choices: string[] } | null {
  const arg = (command.args ?? []).find((a) => a.choices !== undefined);
  if (!arg) return null;
  const raw = typeof arg.choices === 'function'
    ? (arg.choices as () => unknown[])()
    : (arg.choices as unknown[]);
  return { name: arg.name, choices: (raw ?? []).map(String) };
}

function itemsFor(app: TextUIApp, spec: MenuSpec): MenuItem[] {
  return spec.items.flatMap((id, i) => {
    if (id === null) return [];
    const command = app.commands.get(id);
    if (!command) return [];
    const shortcut = app.keybindings.forCommand(id)[0];
    return [{
      id,
      label: command.title,
      ...(shortcut ? { shortcut } : {}),
      disabled: app.commands.enabled(id) === false,
      separatorBefore: spec.items[i - 1] === null && i > 0,
      // A command that will ask a question gets a chevron, as in the palette.
      ...((command.args ?? []).some((a) => a.choices) ? { children: [] } : {}),
    }];
  });
}

/** The id a menu's label carries, which is also its focus id and its anchor. */
function labelId(menuId: string): string {
  return `menubar.${menuId}`;
}

interface MenuLabelProps {
  menu: MenuSpec;
  open: boolean;
  onOpen(spec: MenuSpec): void;
  onStep(from: string, delta: number): void;
}

/**
 * One label in the bar.
 *
 * It is its own component so that it can hold focus. A bar built from bare
 * `text` nodes is reachable by mouse and by nothing else, which is a menu that
 * only exists for people who are already holding one.
 *
 * The focus id is the node id on purpose: the renderer records a rect for any
 * node that names itself, so the same id serves the tab order, the click
 * target and the dropdown's anchor.
 */
const MenuLabel = defineComponent<MenuLabelProps>('MenuLabel', ({ menu, open, onOpen, onStep }) => {
  const focus = useFocus({ id: labelId(menu.id) });

  useInput((event: KeyEvent) => {
    // Down and enter both open, because a menu bar is read as a row and
    // entered as a column and people arrive expecting either.
    if (event.name === 'enter' || event.name === 'space' || event.name === 'down') {
      onOpen(menu);
      return true;
    }
    if (event.name === 'left') { onStep(menu.id, -1); return true; }
    if (event.name === 'right') { onStep(menu.id, 1); return true; }
    return false;
  }, { focusId: focus.id });

  // Open outranks focused: while a dropdown is showing, its label stays lit
  // even though focus has moved into the menu.
  // Colour rather than a filled block.
  //
  // A background swatch behind a word is the heaviest mark a bar can make,
  // and on a light, borderless theme like paper it reads as damage to the
  // page rather than as a selection. Accent ink says the same thing at a
  // fraction of the weight, and bold separates "open" from "focused" without
  // a second colour.
  const fg = open || focus.focused ? 'accent' : 'text';

  // The mnemonic is underlined rather than written out as "File (alt+f)",
  // which is the convention every menu bar already uses and the only one that
  // costs no width - a bar that spells its shortcuts out stops fitting.
  return (
    <box
      id={labelId(menu.id)}
      direction="row"
      onClick={() => onOpen(menu)}
    >
      <text content={menu.label.slice(0, 1)} fg={fg} bold={open} underline />
      <text content={menu.label.slice(1)} fg={fg} bold={open} />
    </box>
  );
});

export const MenuBar: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('MenuBar', () => {
    const runtime = useRuntime();
    const [open, setOpen] = useState<string | null>(null);
    const app = runtime.app();

    const close = (): void => {
      setOpen(null);
      app?.layers.close(DROPDOWN);
    };

    const choose = (id: string): void => {
      close();
      const command = app?.commands.get(id);
      // A command that needs an answer goes to the palette, which is the one
      // place that already knows how to ask - and the one place that can
      // search the answer rather than making you scroll it.
      if (command && choicesOf(command)) {
        void app?.execute('app.palette', { at: command.id }, 'menu');
        return;
      }
      void app?.execute(id, {}, 'menu');
    };

    const show = (spec: MenuSpec): void => {
      if (!app) return;
      if (open === spec.id) { close(); return; }
      app.layers.close(DROPDOWN);
      setOpen(spec.id);
      app.layers.open({
        id: DROPDOWN,
        layer: 'floating',
        position: { kind: 'anchor', targetId: `menubar.${spec.id}`, side: 'bottom', align: 'start' },
        trapFocus: true,
        dismissOnEscape: true,
        dismissOnOutsideClick: true,
        onClose: () => setOpen(null),
        // A panel, not a bare menu: a floating layer paints over what is
        // beneath it only if something actually fills the cells, and a
        // transparent dropdown reads as the tree with words on top of it.
        node: {
          component: 'box',
          id: DROPDOWN_PANEL,
          bg: 'overlay',
          fg: 'text',
          border: app.theme.border,
          width: 34,
          // A borderless theme has no gutter, so the rows would run flush to
          // the panel edge and read as though they were part of the screen
          // behind them.
          ...(app.theme.border === 'none' ? { padding: { left: 1, right: 1 } } : {}),
          // The panel itself takes a key only after the menu inside has
          // declined it, which is how left and right walk the bar while a
          // dropdown is open without the menu losing its own arrows. `global`
          // is what says so: the panel is never the focused node - the menu
          // inside it is - and a focusable that is not focused reads no keys
          // unless it asks to.
          focusable: true,
          skipTab: true,
          global: true,
          onKey: { handler: (event: KeyEvent) => {
            if (event.name === 'left') { walkOpen(spec.id, -1); return true; }
            if (event.name === 'right') { walkOpen(spec.id, 1); return true; }
            return false;
          } },
          children: {
            component: 'Menu',
            items: itemsFor(app, spec),
            autoFocus: true,
            onSelect: { handler: (id: string) => choose(id) },
          },
        },
      });
    };

    /** The menu `delta` places along from `fromId`, wrapping. */
    const neighbour = (fromId: string, delta: number): MenuSpec | null => {
      const at = MENUS.findIndex((m) => m.id === fromId);
      if (at < 0) return null;
      return MENUS[(at + delta + MENUS.length) % MENUS.length] as MenuSpec;
    };

    /** From a label: move focus along the bar and open nothing. */
    const step = (fromId: string, delta: number): void => {
      const next = neighbour(fromId, delta);
      if (next) app?.focus.focus(labelId(next.id));
    };

    /**
     * From inside an open dropdown: move the opening along the bar.
     *
     * Deliberately not the same function as `step`. A handler that lives on
     * the layer node is built once, when the layer opens, so it cannot read
     * `open` - the render that set it had not happened yet. Asking "is a menu
     * open?" from inside an open menu was always going to answer with whatever
     * was true a frame too early.
     */
    const walkOpen = (fromId: string, delta: number): void => {
      const next = neighbour(fromId, delta);
      if (next) show(next);
    };

    // Reaching the bar at all. F10 focuses it rather than opening File,
    // because a bar you can enter and then read is easier to learn than three
    // separate keys you have to already know.
    useCommand({
      id: 'menu.focus', title: 'Focus the menu bar', category: 'View', slots: ['palette'],
      run: () => { app?.focus.focus(labelId(MENUS[0]?.id ?? 'file')); },
    }, [app]);

    // One command per menu, so the bar is reachable from a keybinding and from
    // the palette rather than only from a mouse.
    useCommand({
      id: 'menu.file', title: 'Menu: File', category: 'View', slots: [],
      run: () => show(MENUS[0] as MenuSpec),
    }, [open]);
    useCommand({
      id: 'menu.view', title: 'Menu: View', category: 'View', slots: [],
      run: () => show(MENUS[1] as MenuSpec),
    }, [open]);
    useCommand({
      id: 'menu.help', title: 'Menu: Help', category: 'View', slots: [],
      run: () => show(MENUS[2] as MenuSpec),
    }, [open]);

    return (
      <Row gap={2}>
        {MENUS.map((menu) => (
          <MenuLabel
            key={menu.id}
            menu={menu}
            open={open === menu.id}
            onOpen={show}
            onStep={step}
          />
        ))}
      </Row>
    );
  });
