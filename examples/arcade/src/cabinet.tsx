import {
  Badge, Column, KeyHints, List, Panel, Row,
  defineComponent, useApp, useCapabilities, useEffect, useExecute, useFocus,
  useInput, useMeasure, useMemo, useRef, useScreen, useState, useStore,
  useStoreSubtree, useStoreValue, useTheme, useTicker,
} from '@textui/core';
import type { ListItem, PaintSurface, RenderContext, RenderOutput } from '@textui/core';
import { SCORE_WIDTH, createPainter, createRng, roomFor } from './engine.js';
import type { Game, GameKey } from './engine.js';
import { glyphsFor } from './glyphs.js';
import { GAMES, gameById } from './games/index.js';
import { GENERATION, PAUSED, SCORES, SEED, SELECTED, recordScore } from './data.js';

/**
 * The cabinet: what you pick a game from, and what you play it in.
 *
 * Two screens and one contract between them. The play screen has no idea which
 * game it is running - it steps whatever it was handed, draws whatever that
 * paints and shows whatever that counts - which is why a new game is a file in
 * `games/` and a line in its index, and nothing here changes.
 */

// ------------------------------------------------------------------ cabinet

export const CabinetScreen: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('CabinetScreen', () => {
  const execute = useExecute();
  const theme = useTheme();
  // Seeded here rather than read: which game you were looking at is state, and
  // it outlives the visit, so coming back from a game leaves the cursor on the
  // game you just played instead of at the top of the list.
  const [selected, setSelected] = useStore<string>(SELECTED, GAMES[0]?.id ?? '');
  const scores = useStoreSubtree<Record<string, number>>(SCORES) ?? {};

  const items: ListItem[] = GAMES.map((game) => ({
    id: game.id,
    label: game.title,
    description: game.blurb,
    meta: scores[game.id] ? `best ${scores[game.id]}` : '',
  }));
  const current = gameById(selected) ?? GAMES[0];

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1}>
        <text content="TextUI Arcade" bold fg="accent" />
        <text content={theme.glyphs.separator} fg="subtle" />
        <text content={`${GAMES.length} games`} fg="muted" flex={1} />
      </Row>

      <Row flex={1} gap={1}>
        <Panel title="Games" flex={1}>
          <List
            items={items}
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            // The command, not `screens.push`: enter and the palette entry
            // have to start a game the same way, and only one of them can be
            // the definition of what starting a game means.
            onActivate={(id) => execute('arcade.play', { gameId: id })}
          />
        </Panel>

        {current ? (
          <Panel title={current.title} width={30}>
            <Column gap={1}>
              <text content={current.blurb} wrap="word" fg="muted" />
              <Row gap={1}>
                {/*
                  * The size a person has to have, not the size of the field.
                  * "16 by 20" is a fact about tetrominoes; "52 by 26" is the
                  * question of whether this window is big enough.
                  */}
                <Badge label={`${roomFor(current).width} by ${roomFor(current).height}`} tone="info" />
                <Badge
                  label={scores[current.id] ? `best ${scores[current.id]}` : 'unplayed'}
                  tone={scores[current.id] ? 'success' : 'default'}
                />
              </Row>
              <Column gap={0}>
                <text content="Controls" fg="subtle" />
                {current.controls.map((control) => (
                  <Row key={control.keys} gap={1}>
                    <text content={control.keys} fg="accent" bold width={11} />
                    <text content={control.label} fg="muted" />
                  </Row>
                ))}
              </Column>
            </Column>
          </Panel>
        ) : null}
      </Row>

      <KeyHints
        hints={[
          { keys: `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown}`, label: 'pick' },
          { keys: 'enter', label: 'play' },
          { keys: 'ctrl+c', label: 'quit' },
        ]}
      />
    </Column>
  );
});

// --------------------------------------------------------------------- play

export const PlayScreen: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('PlayScreen', () => {
  const { params } = useScreen<{ gameId?: string }>();
  const game = gameById(params.gameId);

  if (!game) {
    // A screen pushed with an id nothing answers to. Rendered, not thrown: the
    // registry is late-binding everywhere else in this runtime, and a miss is
    // something you can see rather than something that takes the frame down.
    return (
      <Column flex={1} padding={1} gap={1}>
        <text content={`No game called "${String(params.gameId ?? '')}"`} fg="danger" />
        <text content="escape goes back to the cabinet." fg="muted" />
      </Column>
    );
  }

  return <GameStage game={game} />;
});

export interface GameStageProps { game: Game }

/**
 * One game, running.
 *
 * The loop is the shared ticker rather than a timer of its own, so "disable
 * animations" stops a game the way it stops a spinner, and the test harness
 * can advance the clock by hand and get the same run every time.
 */
export const GameStage: (props: GameStageProps) => RenderOutput = defineComponent<GameStageProps>('GameStage', ({ game }) => {
  const app = useApp();
  const theme = useTheme();
  const execute = useExecute();
  const capabilities = useCapabilities();
  const measured = useMeasure();
  const seed = useStoreValue<number>(SEED);
  const paused = useStoreValue<boolean>(PAUSED, false) ?? false;
  const generation = useStoreValue<number>(GENERATION, 0) ?? 0;
  const best = useStoreSubtree<Record<string, number>>(SCORES) ?? {};
  const [, setFrame] = useState(0);

  const glyphs = useMemo(() => glyphsFor(capabilities.unicode), [capabilities.unicode]);

  /**
   * The run.
   *
   * Rebuilt when the generation moves or the game changes, during render
   * rather than in an effect: an effect runs after the frame, so a restart
   * would paint the dead game one last time - the frame that shows "game over"
   * would still be there after the key that cleared it.
   */
  const run = useRef<{ generation: number; gameId: string; state: unknown } | null>(null);
  const recorded = useRef(false);
  if (!run.current || run.current.generation !== generation || run.current.gameId !== game.id) {
    run.current = {
      generation,
      gameId: game.id,
      // No seed set means a different game every time, which is what a person
      // wants. A test sets one and gets the same game twice.
      state: game.create(createRng(seed ?? Date.now())),
    };
    recorded.current = false;
  }
  const state = run.current.state;

  const status = game.status(state);
  // The cabinet the field sits in: the field itself, plus the frame that is
  // its walls. Everything below sizes off these two numbers.
  const width = game.field.width * 2 + 2;
  const height = game.field.height + (game.floor === 'open' ? 1 : 2);
  // What the screen needs around it: the title row, the hints row, the gaps
  // between them and the score pane beside it. Stated rather than discovered,
  // because "it does not fit" has to be a sentence rather than a broken frame.
  const room = roomFor(game);
  const fits = measured.width >= room.width && measured.height >= room.height;

  useTicker((_frame, elapsed) => {
    if (paused || status.over || !fits) return;
    game.step(state, elapsed);
    // The frame *is* the state, so the redraw has to be asked for. Nothing
    // else happened - no store write, no subscriber woken - which is the
    // point of it not being in the store.
    setFrame((f) => f + 1);
  }, { fps: 30 });

  // The score is the application's, not the frame's: it outlives the run and
  // the cabinet shows it. Written once, when the run ends, and in an effect
  // rather than in the middle of rendering the frame that ended it.
  useEffect(() => {
    if (!status.over || recorded.current) return;
    recorded.current = true;
    recordScore(app.store, game.id, status.score);
  }, [status.over, game.id, generation]);

  useFocus({ autoFocus: true });
  useInput((event) => {
    const key = keyOf(event.name, event.char);
    if (!key) return false;
    if (status.over) {
      // Once it is over the game takes no more input, so its own keys become
      // "again". Anything that leaves is a keybinding and is not seen here.
      execute('arcade.restart');
      return true;
    }
    if (paused) return true;
    game.key(state, key);
    setFrame((f) => f + 1);
    return true;
  });

  const banner = status.over ? status.banner : paused ? 'Paused' : undefined;

  const draw = (surface: PaintSurface, ctx: RenderContext): void => {
    const painter = createPainter(game.field, glyphs);
    game.draw(state, painter);
    if (banner) painter.centre(Math.floor(game.field.height / 2), banner, 'warning');

    // The canvas is the inside of the frame and the field is exactly that
    // size, so this is a centre of nothing - kept because a terminal one cell
    // too narrow rounds the field down, and drawing that half a cell off the
    // frame is worse than drawing it a column in.
    painter.flush(
      surface,
      ctx,
      Math.max(0, Math.floor((surface.rect.width - game.field.width * 2) / 2)),
      Math.max(0, Math.floor((surface.rect.height - game.field.height) / 2)),
    );
  };

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1}>
        <text content={game.title} bold fg="accent" />
        <text content={theme.glyphs.separator} fg="subtle" />
        <text content={game.blurb} fg="muted" flex={1} />
        {paused ? <Badge label="paused" tone="warning" icon={theme.glyphs.bulletHalf} /> : null}
      </Row>

      <Row flex={1} gap={1}>
        {fits
          ? (
            // Centred, and no bigger than the field. The border is the wall -
            // it has to be *at* the wall, or a snake dies in what looks like
            // open space fifteen columns short of the edge.
            <box flex={1} direction="column" justify="center" align="center">
              <box
                width={width}
                height={height}
                border={{
                  style: 'bold',
                  color: 'borderStrong',
                  ...(game.floor === 'open'
                    ? { sides: { top: true, left: true, right: true, bottom: false } }
                    : {}),
                }}
              >
                <canvas flex={1} draw={draw} />
              </box>
            </box>
          )
          : (
            <Panel flex={1} title="Not enough room">
              <Column gap={1}>
                <text
                  content={`${game.title} wants ${room.width} by ${room.height} cells.`}
                  fg="danger"
                  wrap="word"
                />
                <text
                  content={`This is ${measured.width} by ${measured.height}. A bigger window, or a smaller game.`}
                  fg="muted"
                  wrap="word"
                />
              </Column>
            </Panel>
          )}

        <Panel title="Score" width={SCORE_WIDTH}>
          <Column gap={0}>
            <text content={String(status.score)} bold fg="accent" />
            <text content={`best ${best[game.id] ?? 0}`} fg="subtle" />
            <spacer size={1} />
            {status.stats.map((stat) => (
              <Row key={stat.label} gap={1}>
                <text content={stat.label} fg="muted" flex={1} />
                <text content={stat.value} />
              </Row>
            ))}
          </Column>
        </Panel>
      </Row>

      {/*
        * What is worth pressing now. Restart is only offered once the run is
        * over, which is when a person wants it and is also what keeps this row
        * short enough to survive a narrow terminal - a footer that truncates
        * every hint is a footer that tells you nothing.
        */}
      <KeyHints
        hints={[
          ...game.controls,
          status.over
            ? { keys: 'r', label: 'again' }
            : { keys: 'p', label: paused ? 'resume' : 'pause' },
          { keys: 'ctrl+c', label: 'leave' },
        ]}
      />
    </Column>
  );
});

/**
 * The keyboard, in one place.
 *
 * Arrows, `wasd` and `hjkl` all mean the same five things, and a game that
 * matched on key names would hold its own copy of that opinion - three copies,
 * disagreeing by the third game.
 */
function keyOf(name: string, char?: string): GameKey | null {
  switch (name) {
    case 'left': case 'a': case 'h': return 'left';
    case 'right': case 'd': case 'l': return 'right';
    case 'up': case 'w': case 'k': return 'up';
    case 'down': case 's': case 'j': return 'down';
    case 'space': case 'enter': return 'action';
    default: return char === ' ' ? 'action' : null;
  }
}
