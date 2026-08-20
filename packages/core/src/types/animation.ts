import type { Disposable } from './disposable.js';

export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | ((t: number) => number);

export interface TweenOptions {
  from: number;
  to: number;
  durationMs: number;
  easing?: Easing;
  onUpdate(value: number): void;
  onComplete?(): void;
}

export interface TickerOptions {
  /** Frames per second. Clamped by the driver's global cap. */
  fps?: number;
  onTick(frame: number, elapsedMs: number): void;
}

/**
 * One driver for every moving thing, so a global disable is one flag and a
 * slow ssh link can drop the frame rate for all of it at once.
 */
export interface AnimationDriver extends Disposable {
  enabled: boolean;
  /** Global ceiling; individual tickers may ask for less. */
  maxFps: number;
  ticker(options: TickerOptions): Disposable;
  tween(options: TweenOptions): Disposable;
  /** Advance manually. The testing harness drives time with this. */
  advance(ms: number): void;
  /** True when animations are off - components render their final state. */
  readonly disabled: boolean;
}
