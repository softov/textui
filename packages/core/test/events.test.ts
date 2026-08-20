import { describe, expect, it, vi } from 'vitest';
import { createEvents } from '../src/core/events.js';

describe('event bus', () => {
  it('delivers to an exact path', () => {
    const events = createEvents();
    const seen = vi.fn();
    events.on('@/dialog/confirm', seen);
    events.emit('@/dialog/confirm', { ok: true });
    expect(seen).toHaveBeenCalledWith({ ok: true }, '@/dialog/confirm');
  });

  it('does not deliver to a sibling', () => {
    const events = createEvents();
    const seen = vi.fn();
    events.on('@/dialog/confirm', seen);
    events.emit('@/dialog/cancel');
    expect(seen).not.toHaveBeenCalled();
  });

  it('delivers to a subtree listener', () => {
    const events = createEvents();
    const seen = vi.fn();
    events.on('@/agent', seen, { subtree: true });
    events.emit('@/agent/restart');
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('once fires a single time', () => {
    const events = createEvents();
    const seen = vi.fn();
    events.on('@/x', seen, { once: true });
    events.emit('@/x');
    events.emit('@/x');
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('next resolves on the following emit', async () => {
    const events = createEvents();
    const p = events.next('@/alerts/selected');
    events.emit('@/alerts/selected', 'billing');
    await expect(p).resolves.toBe('billing');
  });

  it('keeps no value to read back', () => {
    const events = createEvents();
    events.emit('@/gone', 1);
    const seen = vi.fn();
    events.on('@/gone', seen);
    expect(seen).not.toHaveBeenCalled();
  });
});
