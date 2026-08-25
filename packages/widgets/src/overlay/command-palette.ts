import type { ArgChoice, ArgSpec, BoxProps, CommandDefinition, TextUIApp } from '@textui/core';
import {
  defineComponent,
  h,
  stringWidth,
  useEffect,
  useFocusScope,
  useInput,
  useRuntime,
  useState,
  useTheme,
} from '@textui/core';
import { TextInput } from '../control/index.js';
import type { MenuItem } from '../navigation/index.js';
import { Menu } from '../navigation/index.js';
import { hint } from './shared.js';

export interface CommandPaletteProps extends BoxProps {
  /**
   * Rows to search. Defaults to every enabled command in the `palette` slot.
   *
   * A function is re-read every render, which is what a list of switches
   * needs: after one is flipped the row has to show its new state, and a
   * snapshot taken when the palette opened cannot.
   */
  commands?: CommandDefinition[] | (() => CommandDefinition[]);
  placeholder?: string;
  /** Notified after a command runs. The palette runs it itself. */
  onRun?(id: string, args?: Record<string, unknown>): void;
  onClose?(): void;
  /** Off makes this a picker: it reports the choice and runs nothing. */
  execute?: boolean;
  /**
   * Group the list by `category`, with the category named above each group.
   *
   * Only while nothing is typed. A query sorts by relevance, which interleaves
   * the categories - and a heading over one row is not a group.
   */
  grouped?: boolean;
  visibleRows?: number;
  /**
   * A fixed width, in cells.
   *
   * Left off, the panel is as wide as its widest row and no wider than
   * `maxWidth` - which is what a list of five short answers wants, and what a
   * list of five sentences needs. A number here is a number: the panel is that
   * wide whether the rows fill it or overflow it.
   */
  width?: number;
  /**
   * The widest the panel may grow when `width` is left off. 60 by default.
   *
   * There is always a limit: a description is prose, and prose has no width it
   * stops at. Past this the rows truncate, and the row under the cursor slides
   * what it truncated.
   */
  maxWidth?: number;
  /**
   * Where a row's description goes. `inline` right-aligns it beside the label;
   * `below` gives it a line of its own.
   *
   * `below` for a question whose answers differ by a sentence rather than by a
   * word - four approval modes named in two words each are told apart by the
   * line under them, and inline that line is the half that gets truncated.
   * Every row costs two lines, so `visibleRows` buys half as many.
   */
  descriptions?: 'inline' | 'below';
  /**
   * Open already drilled into this command's choices.
   *
   * For a caller that has decided *which* question is being asked and only
   * wants the palette to ask it - a menu item for "Theme" should offer the
   * themes, not the whole command list with "Theme" typed into the search box.
   */
  openAt?: string;
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
    commands, placeholder, onRun, onClose, execute = true,
    grouped = true, visibleRows = 8, width, maxWidth = 60, openAt,
    descriptions = 'inline', ...rest
  } = props;

  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  /** The command being asked about, when the palette has drilled in. */
  const [pending, setPending] = useState<{
    command: CommandDefinition;
    arg: ArgSpec;
    /** Answers given so far, for a command that asks for more than one. */
    collected: Record<string, unknown>;
  } | null>(null);
  const [choices, setChoices] = useState<ArgChoice[]>([]);
  /**
   * Whether the answer to "what may I choose" is still on its way.
   *
   * An empty list is a real answer - a host advertises a harness and no models
   * until somebody has signed into it - and it is not the same answer as "the
   * request is in flight". Both draw an empty menu, so without this the panel
   * that will never have anything in it and the one that is about to look
   * identical, and neither of them says so.
   */
  const [asking, setAsking] = useState(false);
  /** Bumped after a row that stays, so a `commands` function is read again. */
  const [, setRefresh] = useState(0);
  // The search field asks for focus itself. See `Dialog`.
  useFocusScope({ trap: true, restore: true });

  const app = runtime.app();
  const given = typeof commands === 'function' ? commands() : commands;
  const all = given ?? app?.commands.list({ slot: 'palette', enabledOnly: true }) ?? [];

  const matches = pending ? [] : filterCommands(all, query);
  const offered = pending ? filterChoices(choices, query) : [];
  const rows = pending ? offered.map((choice) => choice.value) : matches.map((c) => c.id);
  const index = Math.max(0, Math.min(highlight, rows.length - 1));

  const items: MenuItem[] = pending
    ? (offered.length > 0
      ? offered.map((choice) => ({
        id: choice.value,
        label: choice.label ?? choice.value,
        ...(choice.icon ? { icon: choice.icon } : {}),
        // What it means, when the choice says; "default" otherwise, which is
        // the only thing the palette itself knows about a value.
        ...(choice.description
          ? { description: choice.description }
          : pending.arg.default === choice.value ? { description: 'default' } : {}),
      }))
      // One row, saying which kind of nothing this is. A disabled item rather
      // than no items: the panel keeps its height, so the answer arriving does
      // not move everything under it.
      : [{
        id: '',
        label: asking
          ? `Asking${theme.glyphs.ellipsis}`
          : (query === '' ? 'Nothing to choose' : 'No match'),
        disabled: true,
      }])
    : matches.map((command, i) => ({
        id: command.id,
        label: command.title,
        // What this row does, or the state it is reporting. The category is
        // not here: it names the *group*, so it is said once above it.
        description: command.badge ?? command.description,
        icon: command.icon,
        // A row may stand for a command registered under another id, and the
        // key a person would press belongs to that one.
        shortcut: command.shortcut ?? app?.keybindings.forCommand(command.id)[0],
        // A chevron, from `Menu`, for anything that will ask a question.
        children: argumentOf(command) ? [] : undefined,
        // The heading goes on the first row of each group, including the
        // first - a group with no name over it is the one the reader has to
        // work out from the rows in it.
        //
        // Sorted matches interleave the categories, so a query turns the
        // headings off rather than repeating them: with the rows in relevance
        // order, "Screens" over a single row is noise, and the group it claims
        // to start is one row long.
        ...(grouped && query.trim() === ''
          && (i === 0 || (matches[i - 1] as CommandDefinition).category !== command.category)
          && command.category
          ? { sectionBefore: command.category }
          : {}),
      }));

  const back = (): void => {
    // `null` is "never mind": whatever the preview did gets undone by whoever
    // did it, because only the command knows what it changed.
    pending?.arg.preview?.(null);
    setPending(null);
    setChoices([]);
    setQuery('');
    setHighlight(0);
  };

  const finish = (id: string, args?: Record<string, unknown>): void => {
    // A row that only flips something stays: closing after every switch means
    // reopening the list to reach the next one, which is the wrong answer for
    // a list of switches and the right one for a list of actions. The command
    // says which it is.
    const definition = given?.find((c) => c.id === id) ?? app?.commands.get(id);
    const dismiss = definition?.keepOpen !== true;

    // Close first: the command may open a layer of its own, and the palette
    // should be gone by the time it does rather than sitting underneath it.
    if (dismiss) onClose?.();

    if (execute) {
      // A caller may hand the palette rows the registry has never seen - a
      // list built for one screen, a switch per surface the running shell
      // happens to have. Running those through `execute` would find nothing
      // and silently do nothing, so a definition that came in through `commands`
      // and is not registered is run directly.
      const local = given?.find((c) => c.id === id);
      if (local && !app?.commands.get(id)) {
        void local.run?.(args ?? {}, {
          app: app as TextUIApp,
          store: runtime.store,
          args: args ?? {},
        } as never);
      } else {
        void app?.execute(id, args, 'palette');
      }
    }
    // A row that stayed just changed something the list is describing, so the
    // list has to be asked again. Nothing else will invalidate this component:
    // it is not subscribed to whatever the row touched, and should not be.
    if (!dismiss) setRefresh((n) => n + 1);

    onRun?.(id, args);
  };

  /** Ask about one command. `choices` may be a function, and may be async. */
  const drillInto = (
    command: CommandDefinition,
    arg: ArgSpec,
    collected: Record<string, unknown> = {},
  ): void => {
    const resolved = typeof arg.choices === 'function' ? arg.choices() : arg.choices ?? [];
    setPending({ command, arg, collected });
    setQuery('');

    /*
     * Open on the answer that is already in force.
     *
     * A question about a setting is nearly always asked in order to change it
     * *from* something, and the row that something is on is where the reader
     * is looking. Starting at the top instead says the first option is the
     * current one, which is wrong on every list where it is not - and it
     * costs an extra press to get back to where you began.
     *
     * `default` is the argument's own word for it, and the same one the row
     * labelled "default" already used.
     */
    const startAt = (list: ArgChoice[]): number => {
      const at = list.findIndex((choice) => choice.value === arg.default);
      return at < 0 ? 0 : at;
    };

    if (Array.isArray(resolved)) {
      setAsking(false);
      const list = resolved.map(asChoice);
      setChoices(list);
      setHighlight(startAt(list));
      return;
    }
    setChoices([]);
    setHighlight(0);
    setAsking(true);
    // Answered either way: a `choices` function that rejects leaves the panel
    // saying "nothing to choose", which is true of what it can offer.
    void resolved
      .then((list) => {
        const choices = list.map(asChoice);
        setChoices(choices);
        setHighlight(startAt(choices));
      })
      .catch(() => setChoices([]))
      .finally(() => setAsking(false));
  };

  /**
   * Answer one argument, then ask about the next one or run it.
   *
   * A command with two things to ask about used to have the first one
   * collected and the second one skipped, which meant running it with an
   * argument it said was required - and `execute` refuses that, loudly.
   */
  const answer = (value: unknown): void => {
    if (!pending) return;
    const collected = { ...pending.collected, [pending.arg.name]: value };
    const next = argumentOf(pending.command, collected);
    if (next) {
      drillInto(pending.command, next, collected);
      return;
    }
    finish(pending.command.id, collected);
  };

  const choose = (): void => {
    if (pending) {
      // An argument with choices is answered by picking one; an argument
      // without any is answered by typing it. The palette already has a field
      // and a list, so it is the same overlay either way - and without this a
      // command that asks for a name could be *opened* and never *answered*.
      if (pending.arg.choices === undefined) {
        const typed = query.trim();
        // Nothing typed is not an answer. Running anyway hands the command an
        // empty required argument, which is the error it exists to prevent.
        if (typed === '') return;
        answer(typed);
        return;
      }
      const value = rows[index];
      if (value === undefined) return;
      answer(value);
      return;
    }

    const command = matches[index];
    if (!command) return;

    const arg = argumentOf(command);
    if (!arg) {
      finish(command.id);
      return;
    }

    drillInto(command, arg);
  };

  // Opening at a command is the same act as choosing it, minus the choosing.
  useEffect(() => {
    if (!openAt) return;
    const command = all.find((c) => c.id === openAt) ?? app?.commands.get(openAt);
    const arg = command ? argumentOf(command) : undefined;
    if (command && arg) drillInto(command, arg);
  }, [openAt]);

  // The field owns typing; the list owns up, down and enter. Without this
  // split, Enter submits the search box and the highlighted command is
  // never the thing that runs.
  useInput(
    (event) => {
      if (event.name === 'escape') {
        // Opened at a command, there is nothing behind the question that
        // anybody chose to be at: the caller drilled in on their behalf, and
        // the level underneath is a list of one. Backing out to it reads as
        // "escape did nothing", and the second escape - the one that would
        // close it - is spent leaving a screen nobody asked to see.
        if (pending && !openAt) { back(); return true; }
        // Whatever a highlighted choice previewed has to be put back on the
        // way out, and `null` is how the command is told to undo it - only it
        // knows what it changed. `back()` did that, so closing instead of
        // backing has to do it too, or escaping a theme picker leaves the
        // theme it was merely showing you.
        pending?.arg.preview?.(null);
        onClose?.();
        return true;
      }
      if (event.name === 'left' && pending && query === '' && !openAt) { back(); return true; }
      // Wrapping, both ways. A list you can walk off the end of makes you
      // check where you are before every press; one that comes round means the
      // last item is one key from the first.
      const wrap = (n: number): number =>
        rows.length === 0 ? 0 : (n + rows.length) % rows.length;
      const move = (to: number): true => {
        setHighlight(to);
        // Show what the choice would do while it is merely highlighted. The
        // command put the `preview` there; the palette only reports movement.
        if (pending) pending.arg.preview?.(rows[to] ?? null);
        return true;
      };
      if (event.name === 'up') return move(wrap(index - 1));
      if (event.name === 'down') return move(wrap(index + 1));
      return false;
    },
    { global: true },
  );

  const highlighted = pending ? undefined : matches[index];
  const move = `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown} move`;
  // What the highlighted row is, in full.
  //
  // The rows themselves have to fit, so a choice's own sentence is truncated
  // there - and a sentence about what a mode does is exactly the thing a
  // person needs whole. So the line under the list follows the highlight: the
  // choice's description while there is one, the question's otherwise.
  const chosen = pending ? offered[index] : undefined;
  const detail = pending
    ? chosen?.description
      ?? pending.arg.description ?? `${pending.command.title} needs a ${pending.arg.name}`
    : highlighted?.description ?? highlighted?.id ?? '';

  /*
   * How wide the panel wants to be.
   *
   * A menu sized to a constant is a menu that is too wide for a list of
   * one-word answers and too narrow for a list of sentences, and it is the
   * same menu either way. So it asks for what it holds - the widest row, plus
   * what the row draws around it - and takes `maxWidth` when that is more than
   * there is any point having.
   *
   * `minWidth` keeps the search field, the hint row and the crumb from being
   * the things that decide it: a question with two short answers still needs
   * somewhere to type and a line saying what the keys do.
   */
  const content = Math.max(
    ...items.map((item) => rowWidth(item, descriptions)),
    ...(pending ? [stringWidth(pending.command.title) + 12] : [stringWidth(placeholder ?? '') + 4]),
  );

  return h('box', {
    role: 'dialog',
    label: 'Commands',
    border: theme.border,
    bg: 'overlay',
    // A stated width is a width. Left off, it fits what it holds.
    ...(width !== undefined
      ? { width }
      : { minWidth: Math.min(28, maxWidth), maxWidth, width: Math.min(content, maxWidth) }),
    direction: 'column',
    // A border is a gutter as well as a line. Without one - `paper` sets
    // `border: 'none'` - the rows run flush to the panel edge and the last
    // character sits against whatever is behind it.
    ...(theme.border === 'none' ? { padding: { left: 1, right: 1 } } : {}),
    // The crumb names the command, not its argument. "commands › Theme" is
    // where you are; "commands › id" is what the parameter happens to be
    // called, which is the author's business rather than the reader's.
    title: pending
      ? ` commands ${theme.glyphs.breadcrumb} ${pending.command.title} `
      : ' commands ',
    ...rest,
  },
    h(TextInput, {
      value: query,
      onChange: (next: string) => {
        setQuery(next);
        setHighlight(0);
      },
      onSubmit: choose,
      /*
       * `right` drills into a command's choices, which the hint row has been
       * advertising as `> sub-items` all along.
       *
       * It used to be a case in the handler above, and that handler is global
       * - so it ran only if the focused field declined the key first, and a
       * single-line field never declines `right`. The key did nothing and the
       * footer said it did something. `onEdge` is how a focused field hands
       * a key back.
       */
      onEdge: (edge: 'start' | 'end') => {
        if (edge !== 'end' || pending) return;
        const command = matches[index];
        if (command && argumentOf(command)) choose();
      },
      placeholder: pending
        ? (pending.arg.description ?? (pending.arg.choices === undefined
          ? `${pending.command.title}${theme.glyphs.ellipsis}`
          : `Choose ${pending.command.title.toLowerCase()}${theme.glyphs.ellipsis}`))
        : (placeholder ?? `Type a command${theme.glyphs.ellipsis}`),
      search: true,
      autoFocus: true,
      border: 'none',
    }),
    h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }),
    h(Menu, {
      items,
      visibleRows,
      // The argument gets the last word: only it knows whether its answers are
      // told apart by a word or by a sentence.
      descriptions: pending?.arg.descriptions ?? descriptions,
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
          ? (pending.arg.choices === undefined
            ? hint(theme, ['type it', 'enter confirm', 'esc back'])
            // Nothing to choose is nothing to press enter on, and offering it
            // is how a panel reads as broken rather than as empty.
            : hint(theme, rows.length > 0 ? [move, 'enter choose', 'esc back'] : ['esc back']))
          : hint(theme, [move, 'enter run', `${theme.glyphs.chevronRight} sub-items`, 'esc close']),
        fg: 'subtle',
        truncate: 'end',
      })),
  );
});

/**
 * The argument the palette should ask about, if there is one.
 *
 * A fixed set of choices, or something required that nothing has supplied.
 * Only the first kind used to count, which meant a command declaring "I need a
 * title" ran with no title and did nothing - the one failure mode that looks
 * exactly like a broken key.
 *
 * Exported because "will this command ask something?" is a question other
 * chrome has to answer too - a menu row wants a chevron and wants to hand off
 * rather than run - and the menu bar had written its own version that
 * *called* the `choices` function to find out. A function is allowed to be
 * async, so that answer was sometimes a promise, and the copy went on to call
 * `.map` on it. Whether a command will ask is a property of its declaration;
 * nothing has to be resolved to know it.
 */
export function argumentOf(
  command: CommandDefinition,
  collected: Record<string, unknown> = {},
): ArgSpec | undefined {
  return (command.args ?? []).find(
    (arg) => collected[arg.name] === undefined &&
      (arg.choices !== undefined || (arg.required === true && arg.default === undefined)),
  );
}

/** The short form and the long one, as one shape. */
function asChoice(choice: string | ArgChoice): ArgChoice {
  return typeof choice === 'string' ? { value: choice } : choice;
}

/**
 * Filter on everything a person can see.
 *
 * The label, because that is what they are reading; the value, because a host
 * id is often what somebody types from memory; and the description, because
 * "asks before editing" is how you find a mode whose label is "Default".
 */
function filterChoices(choices: ArgChoice[], query: string): ArgChoice[] {
  const q = query.trim().toLowerCase();
  if (q === '') return choices;
  return choices.filter((choice) => `${choice.label ?? ''} ${choice.value} ${choice.description ?? ''}`
    .toLowerCase().includes(q));
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

/**
 * The cells one row would like, drawn the way this menu draws it.
 *
 * Mirrors `Menu`'s own layout rather than guessing: the cursor's column and
 * the gap after it, the icon when there is one, the label, and then either the
 * description beside it or a line of its own under it. A description on its
 * own line does not widen the row past its own indent, which is why `below`
 * is the layout a long sentence wants.
 */
function rowWidth(item: MenuItem, descriptions: 'inline' | 'below'): number {
  // The marker and its gap; a switch column when the menu has one.
  const lead = 2 + (item.checked !== undefined ? 2 : 0)
    + (item.icon ? stringWidth(item.icon) + 1 : 0);
  const label = stringWidth(item.label);
  const trail = (item.shortcut ? stringWidth(item.shortcut) + 1 : 0) + (item.children ? 2 : 0);
  const description = item.description ? stringWidth(item.description) : 0;

  return descriptions === 'below'
    ? Math.max(lead + label + trail, lead + description)
    : lead + label + (description > 0 ? description + 2 : 0) + trail;
}
