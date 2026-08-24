import type { RenderOutput, TextUIApp } from '@textui/core';
import { defineComponent, useSize, useTheme } from '@textui/core';
import { Column, KeyHints, Row, ScrollView, StatusBar, registerBuiltins } from '@textui/widgets';
import { PANELS, Piece } from './panels.js';

/**
 * Everything on one screen.
 *
 * The other examples each answer one question - a chat, an editor, a room over
 * a socket. This one answers "what is in the box", which is a different shape
 * of problem: it has no state worth having and its output is a *picture*. It
 * exists so a README can show what the catalog looks like without asking
 * anybody to install it and run it.
 *
 * Which is why it is a wrapping row rather than a grid of fixed cells. A grid
 * has to be told how many columns, and the answer changes with the terminal;
 * `flexWrap` puts as many panels on a line as fit and starts another, so the
 * same screen is three columns on a wide terminal, two on a laptop and one in
 * a narrow pane - with no breakpoints and nothing to keep in step.
 *
 * `--wrap` is the number that decides it: the width each panel asks for, which
 * is what the row breaks on. It is a knob because "how wide is a panel" is a
 * judgement about the screenshot rather than a property of the catalog.
 */

export interface ShowcaseOptions {
  /** The width each panel asks for. Three across at 40 needs about 130 cells. */
  wrap: number;
  /** Render one panel by id, for a picture of a single widget. */
  only?: string;
  /**
   * Size to the content instead of filling the terminal.
   *
   * What a still wants. Filling is right for an application - the grid takes
   * the room between the two bars and scrolls what does not fit - and it is
   * wrong for a picture, where whatever scrolled is simply missing. Fitting
   * lets the caller render into a terminal taller than the content and crop
   * back to what was used.
   */
  fit?: boolean;
}

export const Showcase: (props: ShowcaseOptions) => RenderOutput =
  defineComponent<ShowcaseOptions>('Showcase', ({ wrap, only, fit }) => {
    const theme = useTheme();
    const size = useSize();
    const shown = only === undefined ? PANELS : PANELS.filter((p) => p.id === only);
    const rowGap = ['paper', 'paper-dark'].includes(theme.id) ? 1 : 0;
    const grid = (
      <Row flexWrap="wrap" gap={1} rowGap={rowGap} padding={1} align="start">
        {shown.map((piece) => <Piece key={piece.id} piece={piece} width={wrap} />)}
      </Row>
    );

    return (
      <Column {...(fit === true ? {} : { height: '100%' as const })}>
        <StatusBar
          leading={[
            { id: 'name', label: 'textui', icon: theme.glyphs.bulletFilled },
            { id: 'what', label: `${shown.length} of ${PANELS.length} panels` },
          ]}
          trailing={[
            { id: 'theme', label: theme.name },
            { id: 'size', label: `${size.width}×${size.height}` },
          ]}
        />

        {/*
          `overflowY` on the row itself was scrolling nothing and drawing
          nothing. A box that overflows is not a viewport: somebody has to own
          the offset, take the keys that change it and draw the bar that says
          how far down you are, and that somebody is `ScrollView`. It is a tab
          stop, so the arrows reach it, and `autoFocus` puts them there first -
          in a screen that is mostly for looking at, scrolling is the thing you
          want the arrows to do before anything else.

          The row goes *inside* it. A wrapping row overflows across rather than
          along - it has already fitted every panel on the main axis - so the
          axis that runs off the screen is the vertical one, which is the one
          the viewport scrolls.
        */}
        {fit === true ? grid : <ScrollView flex={1} autoFocus>{grid}</ScrollView>}

        <KeyHints
          hints={[
            { keys: '↑ ↓', label: 'scroll' },
            { keys: 'pgup pgdn', label: 'faster' },
            { keys: 'tab', label: 'next control' },
            { keys: 't', label: 'theme' },
            { keys: 'ctrl+c', label: 'quit' },
          ]}
        />
      </Column>
    );
  });

/**
 * Mount it, and give the theme key somewhere to live.
 *
 * Split from `main` the same way the other examples are: this is everything a
 * test needs, and `main` is the terminal, the arguments and the still. Cycling
 * the theme is a *command*, so the palette lists it and the key is a binding
 * over it rather than a keypress handler that only the screen can reach.
 */
export function registerShowcase(app: TextUIApp, options: ShowcaseOptions): void {
  registerBuiltins(app);

  const themes = app.themes.list().map((t) => t.id);
  app.commands.register({
    id: 'showcase.theme',
    title: 'Next theme',
    category: 'View',
    slots: ['palette'],
    run: () => {
      const at = themes.indexOf(app.theme.id);
      app.setTheme(themes[(at + 1) % themes.length] as string);
    },
  });
  app.keybindings.register({ keys: 't', commandId: 'showcase.theme' });

  app.surfaces.open({
    surface: 'main',
    key: 'showcase',
    target: (
      <Showcase
        wrap={options.wrap}
        {...(options.only !== undefined ? { only: options.only } : {})}
        {...(options.fit === true ? { fit: true } : {})}
      />
    ),
  });
}
