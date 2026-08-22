import type { Game } from '../engine.js';
import { snake } from './snake.js';
import { tetris } from './tetris.js';
import { breakout } from './breakout.js';

/**
 * Every game, in one list.
 *
 * Adding a game is a file and a line here. Nothing else knows the games apart:
 * the cabinet lists whatever is in this array and the play screen mounts
 * whichever one it was given, so a fourth game needs no change to either.
 */
export const GAMES: Game[] = [snake, tetris, breakout];

export function gameById(id: string | null | undefined): Game | undefined {
  return GAMES.find((game) => game.id === id);
}

export { snake, tetris, breakout };
