import {
  Row, argumentOf, chorded, defineComponent, useCommand, useFocus, useInput, useRuntime,
  useState,
} from '@textui/core';
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

/**
 * One row of a menu.
 *
 * A command id is the ordinary case. `null` is a separator. `{ expand }` is a
 * list nobody can write down here, because what is in it depends on what is
 * mounted - the sidebar panels are the explorer plus whatever an extension
 * brought, so the View menu reads the surface registry rather than keeping a
 * copy that goes stale the moment git loads.
 */
type MenuEntry = string | null | { expand: 'sidebarPanels' };

interface MenuSpec {
  id: string;
  label: string;
  items: MenuEntry[];
}

export const MENUS: MenuSpec[] = [
  {
    id: 'file',
    label: 'File',
    // Rename and Delete are not here. They act on the thing you have
    // *selected*, which is what the context menu on it is for - a File menu
    // that deletes something you would have to remember choosing is a File
    // menu with a trap in it.
    items: [
      'fs.newFile', 'fs.newFolder', null,
      'file.open', null,
      'file.save', 'file.saveAs', null,
      'file.close', 'app.quit',
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    // Cut, copy and paste are asked of whoever holds the keyboard, so they
    // are here even with the focus elsewhere and say so when pressed. A row
    // that vanishes with focus is a row you cannot find twice.
    items: [
      'edit.undo', 'edit.redo', null,
      'edit.cut', 'edit.copy', 'edit.paste', null,
      'find.inFile', null,
      'find.inWorkspace',
    ],
  },
  {
    id: 'view',
    label: 'View',
    // Layout owns the switches. One entry that opens the list beats one line
    // per hideable part, and the list then grows with the shell instead of
    // with this array.
    items: [
      'app.palette', 'view.theme', 'view.layout', null,
      'view.sidebarPanel', { expand: 'sidebarPanels' }, null,
      'view.markLines',
    ],
  },
  { id: 'help', label: 'Help', items: ['help.keys', 'help.about'] },
];

/**
 * A row, resolved: what it looks like and what it does.
 *
 * The two are together because an expanded row has no command id of its own -
 * "Explorer" is `view.sidebarPanel` with an argument - and a menu that built
 * the labels in one place and worked out the action in another would be two
 * lists that could disagree about what row three is.
 */
export interface MenuRow {
  item: MenuItem;
  run(app: TextUIApp): void;
}

/** The sidebar panels, as rows, checked where one is showing. */
function sidebarRows(app: TextUIApp): MenuRow[] {
  const active = app.surfaces.state('sidebar').activeKey
    ?? app.surfaces.mounts('sidebar')[0]?.key;
  const collapsed = app.store.get<boolean>('$/ui/sidebar/collapsed') === true;

  return app.surfaces.mounts('sidebar').map((mount) => ({
    item: {
      // Namespaced, so it cannot collide with a command id in the same menu.
      id: `sidebar:${mount.key}`,
      label: mount.display?.title ?? mount.key,
      // Which one you are looking at, which is the question this list answers
      // as much as "which are there". A collapsed sidebar is showing none.
      checked: !collapsed && mount.key === active,
    },
    run: (a: TextUIApp) => { void a.execute('view.sidebarPanel', { key: mount.key }, 'menu'); },
  }));
}

/**
 * The rows of one menu.
 *
 * A command that is not registered contributes no row - which is how a menu
 * naming `git.commit` behaves in a workspace that is not a repository.
 */
export function rowsFor(app: TextUIApp, spec: MenuSpec): MenuRow[] {
  const out: MenuRow[] = [];
  let pendingSeparator = false;

  for (const entry of spec.items) {
    if (entry === null) {
      // Remembered rather than emitted: a separator before a row that turned
      // out not to exist is a rule with nothing under it.
      pendingSeparator = out.length > 0;
      continue;
    }

    const rows = typeof entry === 'string' ? commandRow(app, entry) : sidebarRows(app);
    if (rows.length === 0) continue;

    if (pendingSeparator) {
      (rows[0] as MenuRow).item = { ...(rows[0] as MenuRow).item, separatorBefore: true };
      pendingSeparator = false;
    }
    out.push(...rows);
  }
  return out;
}

function commandRow(app: TextUIApp, id: string): MenuRow[] {
  /*
   * Found whether or not it is available right now.
   *
   * `commands.get` honours the `when` clause, so a gated command answers
   * `undefined` and the row simply vanished - `Cut` was in the Edit menu only
   * while a file happened to be open. A menu whose rows come and go is a menu
   * you cannot learn, so an unavailable command is a row that is *there* and
   * greyed, and only a command nothing ever registered contributes nothing.
   */
  const command = app.commands.list().find((c) => c.id === id);
  if (!command) return [];
  const shortcut = app.keybindings.forCommand(id)[0];
  return [{
    item: {
      id,
      label: command.title,
      ...(shortcut ? { shortcut } : {}),
      disabled: app.commands.enabled(id) === false,
      // Undefined for everything that is not a switch, which is what keeps
      // the mark's column out of a menu that has none.
      checked: app.commands.isChecked(id),
      // A command that will ask a question gets a chevron, as in the palette -
      // and it is the palette's own rule, so the chevron and the hand-off in
      // `choose` cannot disagree about which commands those are.
      ...(argumentOf(command) ? { children: [] } : {}),
    },
    run: (a: TextUIApp) => {
      // A command that needs an answer goes to the palette, which is the one
      // place that already knows how to ask - and the one place that can
      // search the answer rather than making you scroll it.
      //
      // Asked of the declaration, never by running the `choices` function.
      // A function may be async - `panel.openWith` has to `stat` the resource
      // before it knows what can open it - and the copy this used to keep
      // called `.map` on the promise it got back, which is a type error
      // reported against the keystroke that opened the menu.
      if (argumentOf(command)) {
        void a.execute('app.palette', { at: command.id }, 'menu');
        return;
      }
      void a.execute(id, {}, 'menu');
    },
  }];
}

const DROPDOWN = 'menubar.dropdown';
const DROPDOWN_PANEL = 'menubar.dropdown.panel';

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
    // Walking the bar is what a plain arrow does. `alt+left` belongs to
    // whatever the application bound it to, even while the bar has focus.
    if (chorded(event)) return false;
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

    /*
     * What a row does is the row's own business.
     *
     * Resolved again here rather than captured when the menu was drawn, so a
     * row cannot act on a registry that has changed underneath it - and it is
     * the same `rowsFor` either way, so the label you pressed and the thing
     * that runs are the same row and not two lists that agree by convention.
     */
    const choose = (spec: MenuSpec, id: string): void => {
      close();
      if (!app) return;
      rowsFor(app, spec).find((row) => row.item.id === id)?.run(app);
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
            if (chorded(event)) return false;
            if (event.name === 'left') { walkOpen(spec.id, -1); return true; }
            if (event.name === 'right') { walkOpen(spec.id, 1); return true; }
            return false;
          } },
          children: {
            component: 'Menu',
            items: rowsFor(app, spec).map((row) => row.item),
            autoFocus: true,
            onSelect: { handler: (id: string) => choose(spec, id) },
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

    /*
     * One command per menu, so the bar is reachable from a keybinding and from
     * the palette rather than only from a mouse.
     *
     * Derived from `MENUS` rather than written out three times: they used to
     * be hand-written and indexed by position, so inserting Edit in the middle
     * pointed `menu.view` at it. `MENUS` is a module constant, so the number
     * of hooks this runs is fixed - which is the rule a loop of hooks has to
     * satisfy, and the reason this one is allowed.
     */
    for (const menu of MENUS) {
      useCommand({
        id: `menu.${menu.id}`,
        title: `Menu: ${menu.label}`,
        category: 'View',
        slots: [],
        run: () => show(menu),
      }, [open]);
    }

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
