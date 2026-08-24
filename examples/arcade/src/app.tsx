import type { CommandDefinition, Disposable, TextUIApp } from '@textui/core';
import { createBag } from '@textui/core';
import { confirm, registerBuiltins } from '@textui/widgets';
import { CabinetScreen, GameStage, PlayScreen } from './cabinet.js';
import { GAMES, gameById } from './games/index.js';
import { GENERATION, PAUSED, SELECTED, newRun } from './data.js';

/**
 * The arcade, as an application.
 *
 * What it is here to show is a screen that runs at thirty frames a second
 * inside a runtime built for forms and lists, and what that costs: one ticker,
 * one canvas, one ref of state that is deliberately not in the store. The rest
 * is the same application shape as anything else - screens, commands, keys
 * that run commands and a dialog that is a layer.
 *
 * Ctrl+C is the interesting key. In raw mode it arrives as a key event rather
 * than a signal, so it is bindable like any other - and it is bound to two
 * different commands under two `when` clauses, because leaving a game and
 * quitting the arcade are different things that want the same key.
 */

const PLAYING = "$/layout/screen/current == 'arcade.play'";

/*
 * Escape is deliberately not bound to anything here.
 *
 * A keybinding runs before the layer manager gets its turn at escape, so
 * `escape -> leave the game` fires while the "leave the game?" dialog is on
 * screen and opens a second one on top of the first. Escape belongs to
 * whatever is topmost, and in this application that is always a layer.
 */

export interface ArcadeOptions {
  /** Also register the shipped catalog. Off when the host already did it. */
  builtins?: boolean;
  /** What Ctrl+C does in the cabinet. A host that embeds this owns its exit. */
  onQuit?(): void;
}

export function registerArcade(app: TextUIApp, options: ArcadeOptions = {}): Disposable {
  const bag = createBag();
  if (options.builtins !== false) bag.add(registerBuiltins(app));

  for (const definition of [
    { component: 'CabinetScreen', render: CabinetScreen },
    { component: 'PlayScreen', render: PlayScreen },
    { component: 'GameStage', render: GameStage },
  ]) {
    bag.add(app.components.register({
      component: definition.component,
      category: 'template',
      renderer: { kind: 'function', render: definition.render },
    }));
  }

  bag.add(app.screens.register({ id: 'arcade.cabinet', component: 'CabinetScreen' }));
  bag.add(app.screens.register({ id: 'arcade.play', component: 'PlayScreen' }));

  for (const command of commands(app, options)) bag.add(app.commands.register(command));

  for (const [keys, commandId, when] of [
    // Two commands, one key. The clause is what tells them apart, so neither
    // has to ask where it is and there is no third command that dispatches.
    ['ctrl+c', 'arcade.leave', PLAYING],
    ['ctrl+c', 'app.quit', undefined],
    ['q', 'arcade.leave', PLAYING],
    ['p', 'arcade.pause', PLAYING],
    ['r', 'arcade.restart', PLAYING],
    ['q', 'app.quit', undefined],
    ['ctrl+p', 'app.palette', undefined],
  ] as const) {
    bag.add(app.keybindings.register({ keys, commandId, ...(when ? { when } : {}) }));
  }

  app.store.set(GENERATION, 0);
  app.screens.reset('arcade.cabinet');
  return bag;
}

function commands(app: TextUIApp, options: ArcadeOptions): CommandDefinition[] {
  const selected = (): string => app.store.get<string>(SELECTED) ?? GAMES[0]?.id ?? '';

  return [
    {
      id: 'arcade.play',
      title: 'Play',
      category: 'Arcade',
      slots: ['palette'],
      args: [{ name: 'gameId', type: 'string' as const, description: 'Which game' }],
      run: (args: Record<string, unknown>) => {
        const id = typeof args.gameId === 'string' ? args.gameId : selected();
        if (!gameById(id)) return;
        app.store.set(SELECTED, id);
        // A fresh run before the screen arrives, so the first frame it paints
        // is the first frame of the game rather than the last frame of the
        // one before it.
        newRun(app.store);
        app.screens.push('arcade.play', { gameId: id });
      },
    },
    {
      id: 'arcade.pause',
      title: 'Pause / Resume',
      category: 'Arcade',
      slots: ['palette'],
      when: PLAYING,
      run: () => app.store.set(PAUSED, !(app.store.get<boolean>(PAUSED) ?? false)),
    },
    {
      id: 'arcade.restart',
      title: 'Restart',
      category: 'Arcade',
      slots: ['palette'],
      when: PLAYING,
      run: () => newRun(app.store),
    },
    {
      id: 'arcade.leave',
      title: 'Leave Game',
      category: 'Arcade',
      slots: ['palette'],
      when: PLAYING,
      run: async () => {
        const game = gameById(app.screens.current()?.params?.gameId as string | undefined);
        // Paused while the question is on screen. Asking "are you sure" over a
        // game that is still running is a question that answers itself.
        const wasPaused = app.store.get<boolean>(PAUSED) ?? false;
        app.store.set(PAUSED, true);

        const yes = await confirm(app.layers, {
          title: 'Leave game',
          message: `Leave ${game?.title ?? 'the game'}? The run ends here - the score is already kept.`,
          confirmLabel: 'Leave',
          cancelLabel: 'Keep playing',
          tone: 'danger',
        });

        if (!yes) {
          app.store.set(PAUSED, wasPaused);
          return;
        }
        app.store.set(PAUSED, false);
        app.screens.pop();
      },
    },
    {
      id: 'app.quit',
      title: 'Quit',
      category: 'Arcade',
      slots: ['palette'],
      run: () => options.onQuit?.(),
    },
    {
      id: 'app.palette',
      title: 'Command Palette',
      category: 'Go',
      slots: [],
      run: () => {
        app.layers.open({
          id: 'palette',
          layer: 'modal',
          scrim: true,
          trapFocus: true,
          dismissOnEscape: true,
          node: {
            component: 'CommandPalette',
            width: 52,
            commands: app.commands.list({ slot: 'palette', enabledOnly: true }),
            onClose: { handler: () => app.layers.close('palette') },
          },
        });
      },
    },
  ];
}
