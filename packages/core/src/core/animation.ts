import type { AnimationDriver, Easing, TickerOptions, TweenOptions } from '../types/animation.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';

const EASINGS: Record<string, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

function easingFn(easing: Easing | undefined): (t: number) => number {
  if (typeof easing === 'function') return easing;
  return EASINGS[easing ?? 'easeOut'] as (t: number) => number;
}

interface Ticker {
  fps: number;
  onTick(frame: number, elapsedMs: number): void;
  frame: number;
  accumulated: number;
}

/**
 * One driver for everything that moves.
 *
 * Spinners, progress, value transitions and appearing elements all run off the
 * same clock, so `enabled = false` is a single flag that stops all of it, and
 * a slow link can drop the frame rate for all of it at once. The clock can
 * also be driven by hand, which is how the test harness advances time.
 */
export class Animation implements AnimationDriver {
  enabled = true;
  maxFps = 30;

  private tickers = new Set<Ticker>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;
  private manual: boolean;

  constructor(options: { enabled?: boolean; maxFps?: number; manual?: boolean } = {}) {
    this.enabled = options.enabled ?? true;
    this.maxFps = options.maxFps ?? 30;
    this.manual = options.manual ?? false;
  }

  get disabled(): boolean {
    return !this.enabled;
  }

  ticker(options: TickerOptions): Disposable {
    const entry: Ticker = {
      fps: Math.min(options.fps ?? this.maxFps, this.maxFps),
      onTick: options.onTick,
      frame: 0,
      accumulated: 0,
    };
    this.tickers.add(entry);
    this.ensureRunning();
    return toDisposable(() => {
      this.tickers.delete(entry);
      this.stopIfIdle();
    });
  }

  tween(options: TweenOptions): Disposable {
    const { from, to, durationMs, onUpdate, onComplete } = options;
    const ease = easingFn(options.easing);

    if (!this.enabled || durationMs <= 0) {
      onUpdate(to);
      onComplete?.();
      return toDisposable(() => {});
    }

    let elapsed = 0;
    const ticker = this.ticker({
      fps: this.maxFps,
      onTick: (_frame, delta) => {
        elapsed += delta;
        const t = Math.min(1, elapsed / durationMs);
        onUpdate(from + (to - from) * ease(t));
        if (t >= 1) {
          ticker.dispose();
          onComplete?.();
        }
      },
    });
    return ticker;
  }

  /** Advance by hand. The test harness and the static renderer use this. */
  advance(ms: number): void {
    this.tick(ms);
  }

  private tick(delta: number): void {
    if (!this.enabled) return;
    for (const ticker of [...this.tickers]) {
      const interval = 1000 / Math.max(1, ticker.fps);
      ticker.accumulated += delta;
      if (ticker.accumulated < interval) continue;

      const frames = Math.floor(ticker.accumulated / interval);
      ticker.accumulated -= frames * interval;
      ticker.frame += frames;
      try {
        ticker.onTick(ticker.frame, frames * interval);
      } catch {
        // A failing ticker must not take the frame loop down with it.
        this.tickers.delete(ticker);
      }
    }
  }

  private ensureRunning(): void {
    if (this.manual || this.timer || !this.enabled || this.tickers.size === 0) return;
    const interval = Math.max(1000 / this.maxFps, 16);
    this.lastTime = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastTime;
      this.lastTime = now;
      this.tick(delta);
    }, interval);
    this.timer.unref?.();
  }

  private stopIfIdle(): void {
    if (this.tickers.size > 0 || !this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.tickers.clear();
  }
}

export function createAnimation(options?: ConstructorParameters<typeof Animation>[0]): Animation {
  return new Animation(options);
}
