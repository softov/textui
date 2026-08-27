import type {
  CellStyle, Disposable, KeyEvent, MouseEvent, RenderOutput, TextUIApp,
} from '@textui/core';
import {
  ATTR_UNDERLINE, createBag, defineComponent, useMeasure, useRef, useStore, useStoreValue,
  useTicker,
} from '@textui/core';
import type { InkCell } from '@textui/widgets';
import { ColorText, KeyHints, registerBuiltins } from '@textui/widgets';
import type { Cell, Frame as MovieFrame, Movie } from './motion.js';
import { contentBox, key, serialise, totalMs, usedColors } from './motion.js';
import type { Hex } from './palette.js';
import { atHue, fromHex, hueAt, hueIndex, hueRamp, stepHue, stepLight } from './palette.js';

/**
 * An ASCII Motion document, played and edited in a terminal.
 *
 * Two things this example exists to show. The first is that a per-cell
 * animation needs no per-cell component: the frame is one string handed to one
 * `<ColorText>`, and an ink function answers "what colour is this cell" from
 * the frame's own map. Three thousand cells, one node.
 *
 * The second is the timing. These documents hold each frame for its own
 * duration, so the ticker does not advance a frame per tick - it accumulates
 * elapsed milliseconds and advances when the current frame's hold is spent.
 * A fixed frame rate would flatten a 700ms glide and a 67ms wingbeat into the
 * same thing, which is the animation gone.
 */

export const FRAME = '$/flip/frame';
export const MODE = '$/flip/mode';
export const PLAYING = '$/flip/playing';
export const CX = '$/flip/cx';
export const CY = '$/flip/cy';
export const INK = '$/flip/ink';
export const REV = '$/flip/rev';
export const CLIP = '$/flip/clip';

/** Set once at boot. The document is large and never re-created. */
export const loaded: {
  movie: Movie | null;
  path: string | null;
  saved: string | null;
  /** Which mode to open in. `--edit` skips the playback you would pause anyway. */
  mode: 'view' | 'edit';
} = { movie: null, path: null, saved: null, mode: 'view' };

const movie = (): Movie => {
  if (!loaded.movie) throw new Error('flipbook: no movie loaded');
  return loaded.movie;
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** The content box, computed once - it drives where a wide canvas is framed. */
let cachedBox: ReturnType<typeof contentBox> | null = null;
const box = (): ReturnType<typeof contentBox> => (cachedBox ??= contentBox(movie()));

/**
 * Lift a cell onto the brush.
 *
 * `null` for an empty cell, which is not a failure: the brush becomes a blank,
 * and a blank is the erase brush.
 */
const copyFrom = (frame: MovieFrame, x: number, y: number): Cell | null =>
  frame.cells.get(key(x, y)) ?? null;

/**
 * Put the brush down, in the ink.
 *
 * The brush is a *character*; the colour is the ink, and only the ink. It used
 * to carry the colour it was lifted at, which made the swatch in the sidebar
 * stay that colour while the ink moved underneath it - so changing the ink
 * appeared to do nothing to the brush, and pasting put down the old colour.
 *
 * Nothing is lost by dropping it, because copying already sets the ink to the
 * colour it found: a copy followed by a paste reproduces the cell exactly, and
 * it is only changing the ink *afterwards* that now changes what goes down.
 *
 * A blank clears the cell rather than painting a space.
 */
function pasteInto(frame: MovieFrame, x: number, y: number, brush: string, ink: Hex): void {
  if (brush === ' ' || brush === '') frame.cells.delete(key(x, y));
  else frame.cells.set(key(x, y), { char: brush, color: ink });
}

// -------------------------------------------------------------------- stage

const HUE_STEPS = 24;

/** Fixed in both modes - see `Sidebar`. */
const SIDEBAR = 26;

/** The canvas: one `<ColorText>` and an ink that reads the frame's cell map. */
const Stage = defineComponent<Record<string, never>>('FlipStage', () => {
  const film = movie();
  const rect = useMeasure();
  const index = clamp(useStoreValue<number>(FRAME, 0) ?? 0, 0, film.frames.length - 1);
  const mode = useStoreValue<string>(MODE, loaded.mode) ?? loaded.mode;
  const [inkValue, setInk] = useStore<Hex>(INK, '#ffffff');
  const ink = inkValue ?? '#ffffff';
  // Read so an edit repaints; the number itself is only ever bumped.
  const [rev, setRev] = useStore<number>(REV, 0);
  const [clip, setClip] = useStore<string | null>(CLIP, null);
  // A character or nothing: `useStore` answers `undefined` before anything is
  // written, and `' '` - the erase brush - is a character like any other.
  const brush: string | null = clip ?? null;
  const [cx, setCx] = useStore<number>(CX, box().x);
  const [cy, setCy] = useStore<number>(CY, box().y);

  const frame = film.frames[index];
  if (!frame) return <box />;

  // The block is exactly the pane, never smaller. A block narrower than the
  // pane gets centred by the layout, and then the text no longer starts at
  // `rect.x` - so every pointer coordinate is off by half the slack, on wide
  // terminals only, which is the worst way for it to be wrong. Cells outside
  // the canvas simply read as ground.
  const viewW = Math.max(1, rect.width || film.width);
  const viewH = Math.max(1, rect.height || film.height);

  // One framing rule for both modes: centre the drawing, then scroll only as
  // far as the cursor demands. Switching to edit must not move the picture -
  // re-framing on mode change throws away every coordinate the eye had just
  // learned, which is the whole point of looking at it before editing it.
  //
  // A canvas that fits sits at its origin; one that does not hangs past the
  // edge rather than being clamped inside, or a drawing at the bottom of a
  // tall sheet would sit hard against the floor with the empty half above it.
  const centreX = box().x + Math.floor(box().width / 2);
  const centreY = box().y + Math.floor(box().height / 2);
  let originX = centreX - Math.floor(viewW / 2);
  let originY = centreY - Math.floor(viewH / 2);

  if (mode === 'edit') {
    const margin = 2;
    const x = cx ?? 0, y = cy ?? 0;
    if (x < originX + margin) originX = x - margin;
    else if (x > originX + viewW - 1 - margin) originX = x - viewW + 1 + margin;
    if (y < originY + margin) originY = y - margin;
    else if (y > originY + viewH - 1 - margin) originY = y - viewH + 1 + margin;
  }

  const lines: string[] = [];
  for (let row = 0; row < viewH; row++) {
    let line = '';
    for (let col = 0; col < viewW; col++) {
      line += frame.cells.get(key(originX + col, originY + row))?.char || ' ';
    }
    lines.push(line);
  }

  const paint = (cell: InkCell): CellStyle => {
    const x = originX + cell.col, y = originY + cell.line;
    const found = frame.cells.get(key(x, y));
    if (mode === 'edit' && x === cx && y === cy) {
      // An underline rather than a filled block: a block hides the character
      // it is standing on, which is the one thing you need to see while
      // drawing over it. On an empty cell the rule takes the pen's colour, so
      // the cursor also answers what the next keystroke would draw in.
      return { fg: found?.color ?? ink, bg: film.ground, attrs: ATTR_UNDERLINE };
    }
    return { fg: found?.color ?? film.ground, bg: film.ground };
  };

  const onMouse = (event: MouseEvent): boolean => {
    if (event.action !== 'down' || event.button !== 'left') return false;
    const x = originX + (event.x - rect.x);
    const y = originY + (event.y - rect.y);
    if (x < 0 || y < 0 || x >= film.width || y >= film.height) return false;
    setCx(x);
    setCy(y);
    if (mode !== 'edit') return true;

    if (event.ctrl) {
      const picked = copyFrom(frame, x, y);
      setClip(picked?.char ?? ' ');
      // Copy is the eyedropper too, which is what makes the brush carrying no
      // colour of its own lossless: paste straight after reproduces the cell.
      if (picked && picked.char !== ' ') setInk(picked.color);
    } else if ((event.shift || event.alt) && brush !== null) {
      pasteInto(frame, x, y, brush, ink);
      setRev((rev ?? 0) + 1);
    }
    return true;
  };

  return (
    <box flex={1} onMouse={onMouse}>
      <ColorText content={lines.join('\n')} ink={paint} wrap="none" />
    </box>
  );
});

// ------------------------------------------------------------------ sidebar

interface SwatchesProps {
  title: string;
  colors: { color: Hex; label?: string }[];
  active: string;
  onPick(color: Hex): void;
}

const Swatches = defineComponent<SwatchesProps>('FlipSwatches', (props) => (
  <box direction="column">
    <text content={props.title} fg="muted" />
    {props.colors.length === 0
      ? <text content="  none yet" fg="subtle" />
      : props.colors.map((entry) => (
          <box
            key={entry.color}
            direction="row"
            gap={1}
            onClick={() => props.onPick(entry.color)}
          >
            <text content={entry.color === props.active ? '▸' : ' '} fg="accent" />
            <text content="███" fg={entry.color} />
            <text content={entry.label ?? entry.color} fg="muted" />
          </box>
        ))}
  </box>
));

/** The frames and their holds, which is the timeline read as a list. */
const Reel = defineComponent<Record<string, never>>('FlipReel', () => {
  const film = movie();
  const at = clamp(useStoreValue<number>(FRAME, 0) ?? 0, 0, film.frames.length - 1);
  return (
    <box direction="column">
      <text content="frames" fg="muted" />
      {film.frames.map((f, i) => (
        <box key={f.id} direction="row" gap={1}>
          <text content={i === at ? '▸' : ' '} fg="accent" />
          <text content={f.name} bold={i === at} fg={i === at ? 'text' : 'muted'} />
          <box flex={1} />
          <text content={`${f.duration}ms`} fg="subtle" />
        </box>
      ))}
    </box>
  );
});

/**
 * Hue as a row you step, plus the colours this document already uses.
 *
 * Rendered in both modes, and the same width in both, because a column that
 * appears when you press ctrl+e narrows the pane beside it - and a narrower
 * pane re-frames the drawing, so the picture jumps at the exact moment you
 * were about to point at part of it.
 */
const Sidebar = defineComponent<Record<string, never>>('FlipSidebar', () => {
  const film = movie();
  const editing = (useStoreValue<string>(MODE, loaded.mode) ?? loaded.mode) === 'edit';
  const [ink, setInk] = useStore<Hex>(INK, '#ffffff');
  const current = fromHex(ink ?? '#ffffff');
  const ramp = hueRamp(current, HUE_STEPS);
  const at = hueIndex(current, HUE_STEPS);

  const clip = useStoreValue<string | null>(CLIP, null) ?? null;
  const used = usedColors(film).slice(0, 4).map((u) => ({ color: u.color, label: `${u.count}` }));
  const recent = film.recent.map((color) => ({ color }));

  if (!editing) {
    return (
      <box direction="column" width={SIDEBAR} gap={1} padding={[0, 1]}>
        <Reel />
      </box>
    );
  }

  return (
    <box direction="column" width={SIDEBAR} gap={1} padding={[0, 1]}>
      <box direction="column">
        <text content="ink" fg="muted" />
        <box direction="row" gap={1}>
          <text content="████" fg={ink ?? '#ffffff'} />
          <text content={ink ?? '#ffffff'} bold />
        </box>
      </box>

      <box direction="column">
        <text content="hue  shift+←→" fg="muted" />
        {/* One cell per step, clickable, with the marker on the row below so
          * the ramp itself is never interrupted by the pointer that reads it. */}
        <box direction="row">
          {ramp.map((color, i) => (
            // `atHue`, the same rule the cell was drawn with - so what a click
            // paints in is the colour under the pointer rather than the ink's
            // own saturation wearing a different hue.
            <box key={color} onClick={() => setInk(atHue(current, hueAt(i, HUE_STEPS)))}>
              <text content="█" fg={color} />
            </box>
          ))}
        </box>
        <text content={`${' '.repeat(at)}▲`} fg="accent" />
        <text content={`light  shift+↑↓   ${current.l}%`} fg="muted" />
      </box>

      <box direction="column">
        <text content="brush" fg="muted" />
        {/* In the ink, because that is what pasting puts down. Drawn in the
          * colour it was lifted at, it sat there unchanged while the ink moved
          * above it - so changing the colour looked like it had missed the
          * brush, and the brush was the one thing about to use it. */}
        <box direction="row" gap={1}>
          <text
            content={clip === null ? '·' : clip === ' ' ? '␠' : clip}
            fg={clip !== null && clip !== ' ' ? ink ?? '#ffffff' : 'subtle'}
            bold
          />
          <text
            content={clip === null ? 'nothing copied' : clip === ' ' ? 'erase' : 'in the ink'}
            fg="muted"
          />
        </box>
        <text content="ctrl+insert  copy" fg="subtle" />
        <text content="shift+ins    paste" fg="subtle" />
        <text content="alt+ins      paste" fg="subtle" />
        <text content="or the same + click" fg="subtle" />
      </box>

      <Swatches title="used in this file" colors={used} active={ink ?? ''} onPick={(c) => setInk(c)} />
      <Swatches title="recent" colors={recent} active={ink ?? ''} onPick={(c) => setInk(c)} />
    </box>
  );
});

// -------------------------------------------------------------------- frame

export const Frame: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('FlipbookFrame', () => {
  const film = movie();
  const [index, setIndex] = useStore<number>(FRAME, 0);
  const [mode, setMode] = useStore<string>(MODE, loaded.mode);
  const [playing, setPlaying] = useStore<boolean>(PLAYING, true);
  const [cx, setCx] = useStore<number>(CX, box().x);
  const [cy, setCy] = useStore<number>(CY, box().y);
  const [ink, setInk] = useStore<Hex>(INK, film.recent[0] ?? '#ffffff');
  const [rev, setRev] = useStore<number>(REV, 0);
  const [clip, setClip] = useStore<string | null>(CLIP, null);
  const brush: string | null = clip ?? null;
  const [note, setNote] = useStore<string>('$/flip/note', '');

  const at = clamp(index ?? 0, 0, film.frames.length - 1);
  const frame = film.frames[at];
  const editing = mode === 'edit';

  // Milliseconds owed to the current frame. A ticker fires on its own cadence;
  // the timeline is in the document, so elapsed time is what advances it.
  const owed = useRef(0);
  useTicker((_tick, delta) => {
    owed.current += delta;
    const hold = film.frames[at]?.duration ?? 100;
    if (owed.current < hold) return;
    owed.current -= hold;
    // A long stall (a resize, a slow frame) should resync, not fast-forward.
    if (owed.current > hold * 4) owed.current = 0;
    setIndex((at + 1) % film.frames.length);
  }, { fps: 60, enabled: !editing && (playing ?? true) });

  const bump = (): void => setRev((rev ?? 0) + 1);
  const write = (char: string): void => {
    if (!frame) return;
    frame.cells.set(key(cx ?? 0, cy ?? 0), { char, color: ink ?? '#ffffff' });
    bump();
  };
  const erase = (): void => {
    if (!frame) return;
    frame.cells.delete(key(cx ?? 0, cy ?? 0));
    bump();
  };
  const move = (dx: number, dy: number): void => {
    setCx(clamp((cx ?? 0) + dx, 0, film.width - 1));
    setCy(clamp((cy ?? 0) + dy, 0, film.height - 1));
  };
  const shiftFrame = (by: number): void => {
    owed.current = 0;
    setIndex((at + by + film.frames.length) % film.frames.length);
  };
  const flash = (text: string): void => setNote(text);

  const onKey = (event: KeyEvent): boolean => {
    // Mode and frame first: both work in either mode, which is what makes
    // tab-through-frames usable while drawing.
    if (event.ctrl && (event.name === 'e' || event.char === 'e')) {
      setMode(editing ? 'view' : 'edit');
      setNote('');
      return true;
    }
    if (event.name === 'tab') { shiftFrame(event.shift ? -1 : 1); return true; }
    if (event.ctrl && (event.name === 's' || event.char === 's')) { save(flash); return true; }

    if (!editing) {
      if (event.name === 'space') { setPlaying(!(playing ?? true)); return true; }
      if (event.name === 'right') { shiftFrame(1); return true; }
      if (event.name === 'left') { shiftFrame(-1); return true; }
      return false;
    }

    // Shift-arrows drive the colour, because the plain arrows are the cursor
    // and a drawing surface cannot give those up.
    const pen = ink ?? '#ffffff';
    if (event.shift && event.name === 'left') { setInk(stepHue(pen, -15)); return true; }
    if (event.shift && event.name === 'right') { setInk(stepHue(pen, 15)); return true; }
    if (event.shift && event.name === 'up') { setInk(stepLight(pen, 5)); return true; }
    if (event.shift && event.name === 'down') { setInk(stepLight(pen, -5)); return true; }

    // Insert rather than a modified click, because most terminals keep
    // shift+click for their own text selection and the application never sees
    // it. These are the same two operations, on keys that arrive.
    // Alt is accepted alongside shift for paste: where a terminal keeps
    // shift for itself, alt is usually still delivered.
    if (event.name === 'insert' && (event.ctrl || event.shift || event.alt)) {
      if (!frame) return true;
      if (event.ctrl) {
        const picked = copyFrom(frame, cx ?? 0, cy ?? 0);
        setClip(picked?.char ?? ' ');
        if (picked && picked.char !== ' ') setInk(picked.color);
        flash(!picked || picked.char === ' ' ? 'copied a blank - paste erases' : `copied ${picked.char}`);
      } else if (brush !== null) {
        pasteInto(frame, cx ?? 0, cy ?? 0, brush, ink ?? '#ffffff');
        bump();
      } else {
        flash('nothing copied yet - ctrl+insert first');
      }
      return true;
    }

    switch (event.name) {
      case 'left': move(-1, 0); return true;
      case 'right': move(1, 0); return true;
      case 'up': move(0, -1); return true;
      case 'down': move(0, 1); return true;
      case 'delete': erase(); return true;
      case 'backspace': erase(); move(-1, 0); return true;
      case 'space': write(' '); move(1, 0); return true;
      case 'enter': setCx(box().x); move(0, 1); return true;
      default: break;
    }

    // Anything that produced a character draws it. This is the whole of the
    // editor's typing model: no tool to select, the key is the glyph.
    if (event.char && !event.ctrl && !event.alt && event.char.length === 1) {
      write(event.char);
      move(1, 0);
      return true;
    }
    return false;
  };

  const dirty = loaded.saved !== null && loaded.saved !== serialise(film);

  return (
    <box direction="column" flex={1} onKey={onKey} global focusable autoFocus>
      <box direction="row" gap={1} padding={[0, 1]}>
        <text content={film.name} bold />
        <text content={`${film.width}×${film.height}`} fg="muted" />
        <box flex={1} />
        <text content={editing ? ' EDIT ' : ' PLAY '} bold fg={editing ? 'warning' : 'success'} />
      </box>

      <box direction="row" flex={1} gap={1}>
        <box flex={1} border="round" title={frame?.name ?? ''} padding={[0, 1]}>
          <Stage />
        </box>
        <Sidebar />
      </box>

      <box direction="row" gap={2} padding={[0, 1]}>
        {/* The frame counter they asked for, and the only place the timeline
          * is visible as a timeline: this frame's hold against the whole. */}
        <text content={`${at + 1} / ${film.frames.length}`} bold />
        <text content={`${frame?.duration ?? 0}ms of ${totalMs(film)}ms`} fg="muted" />
        {editing ? <text content={`cell ${cx ?? 0},${cy ?? 0}`} fg="muted" /> : null}
        {dirty ? <text content="modified" fg="warning" /> : null}
        {note ? <text content={note} fg="success" /> : null}
      </box>

      <KeyHints
        padding={[0, 1]}
        hints={
          editing
            ? [
                { keys: '←↑↓→', label: 'move' },
                { keys: 'any key', label: 'draw' },
                { keys: 'del', label: 'erase' },
                { keys: 'tab', label: 'frame' },
                { keys: 'ctrl+s', label: 'save' },
                { keys: 'ctrl+e', label: 'play' },
              ]
            : [
                { keys: 'space', label: (playing ?? true) ? 'pause' : 'play' },
                { keys: '←→', label: 'step' },
                { keys: 'tab', label: 'frame' },
                { keys: 'ctrl+e', label: 'edit' },
                { keys: 'ctrl+c', label: 'quit' },
              ]
        }
      />
    </box>
  );
});

/** Write the document back where it came from, keeping every field it had. */
function save(flash: (text: string) => void): void {
  const film = loaded.movie;
  if (!film) return;
  if (!loaded.path) { flash('no file to save to - pass --file'); return; }
  void import('node:fs/promises').then(async (fs) => {
    const text = serialise(film);
    await fs.writeFile(loaded.path as string, text, 'utf8');
    loaded.saved = text;
    flash(`saved ${loaded.path}`);
  }).catch((err: unknown) => flash(`save failed: ${String(err)}`));
}

export function registerFlipbook(app: TextUIApp): Disposable {
  const bag = createBag();
  bag.add(registerBuiltins(app));
  bag.add(app.components.register({
    component: 'FlipbookFrame',
    category: 'chrome',
    renderer: { kind: 'function', render: Frame },
  }));
  return bag;
}
