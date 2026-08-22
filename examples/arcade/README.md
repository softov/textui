# Arcade

Three games in a cabinet: snake, tetris and breakout.

It is here because a game asks the runtime for things a form never does - a
frame every 33ms, keys that arrive faster than the thing they steer, a screen
whose whole content is painted rather than composed - and all of that has to
work in a library built for lists and panels. If it does, the frame loop, the
input path and the canvas are honest.

```bash
pnpm example arcade
pnpm example arcade --static --play tetris --seed 7   # one frame, to stdout
pnpm example arcade --unicode ascii                   # no blocks, still a game
```

## What to look at first

[`src/engine.ts`](src/engine.ts) - the contract. A game is a state machine and
a painter: `step` is given elapsed milliseconds, `key` is given one of five
directions, `draw` is given a field of cells. Nothing in a game knows it is in
a terminal, which is why [`test/games.test.ts`](test/games.test.ts) can check
that a line clears without mounting anything.

[`src/cabinet.tsx`](src/cabinet.tsx) - the two screens. The play screen never
learns which game it is running, so a fourth game is a file in
[`src/games/`](src/games) and a line in its index.

## The things it is careful about

**The frame is not the store.** Game state is mutable and lives in a ref. The
store is the application's state - the high scores, which game is selected,
whether it is paused - and all of that is written. A tetromino's y position
thirty times a second is not application state, and putting it there would wake
every subscriber to describe something gone by the next tick.

**The border is the wall.** The field is a fixed size in cells and sits inside
a frame drawn at its exact edge. An earlier version let the canvas fill the
pane and centred the field inside it, which meant a snake died against an
invisible wall fifteen columns short of the border a player was reading. A
frame that is not where the rules are is worse than no frame. Breakout's floor
is not a wall, so breakout's frame does not draw one.

**Ctrl+C is a key.** In raw mode it arrives as a key event rather than a
signal, so it is bound like any other - twice, to two commands, under two
`when` clauses: inside a game it asks whether to leave, in the cabinet it
quits. Nothing has to ask where it is.

Escape is bound to nothing. A keybinding runs before the layer manager gets its
turn at escape, so `escape -> leave the game` fires while the "leave the game?"
dialog is open and puts a second one on top of it. Escape belongs to whatever
is topmost, and here that is always a layer.

**The difficulty is a curve, and it was measured rather than guessed.** A
simulated player - one that looks at the ball every 100, 200 or 350ms and taps
towards it - plays a rack at each level, and the balance is set from what it
survives: levels one to three lose no lives at any reaction time, level five is
a real fight, level seven ends it. Two levels at each paddle width, so a rack
cleared is either a faster ball or a smaller paddle and never both. A rack is
four rows of sixteen rather than five of eighteen, because a level nobody
finishes makes every number behind it theoretical.

**A key is an impulse, not a step.** A terminal never says a key is *held*: it
sends one event, waits out the operating system's repeat delay - half a second
on most machines - and only then sends more. Breakout's paddle used to move one
cell per event, so it moved once, froze for half a second while the ball kept
going, and the first rally was unwinnable. Now a press sets a direction and
buys the paddle 140ms of travel, and the travelling happens in `step` with
everything else that moves: repeats top it back up into continuous motion, and
a single tap glides about three cells.

**A cell is two columns wide**, or a square field is drawn half as tall as it
is wide. Bricks, tetrominoes and snake segments are laid out in cells; the ball
in breakout is drawn as a *dot* - one column, half a row - so it moves between
the rows the bricks sit on instead of jumping between them. On an ascii
terminal the half-row is lost and the ball moves in whole rows, which is the
honest downgrade: a terminal with one glyph per cell cannot draw half of one.

**Sizes are promised before they are needed.** `roomFor` is one formula, used
by the cabinet to show what a game will need and by the play screen to decide
whether it can draw. Tetris is twenty rows tall and wants a 26-row terminal;
below that it says so rather than drawing three quarters of a well.

## Room

| | |
|---|---|
| Snake | 68 × 22 |
| Tetris | 52 × 26 |
| Breakout | 60 × 20 |

## Adding a game

A file in `src/games/` exporting a `Game`, and a line in
[`src/games/index.ts`](src/games/index.ts). Give it a seeded `create`, keep its
own clock inside its state, and draw in cells. Nothing else knows the games
apart.
