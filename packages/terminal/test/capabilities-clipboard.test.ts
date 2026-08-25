import { describe, expect, it } from 'vitest';
import { detectCapabilities } from '../src/capabilities.js';

/**
 * OSC 52 over ssh.
 *
 * The clipboard capability required a recognised terminal, and none of the
 * variables that name one survive an ssh hop: `TERM_PROGRAM`,
 * `KITTY_WINDOW_ID` and `WT_SESSION` are set by the terminal you are sitting
 * at, not by the machine the program runs on. So a remote session saw a bare
 * `xterm-256color`, decided the terminal could not take a clipboard write, and
 * dropped every copy - in the one situation OSC 52 was specified for.
 */
describe('the clipboard capability', () => {
  const caps = (env: Record<string, string | undefined>) =>
    detectCapabilities({ env: { TERM: 'xterm-256color', ...env }, isTTY: true });

  it('is on for a terminal that names nothing about itself', () => {
    expect(caps({}).clipboard).toBe(true);
  });

  it('is on at the far end of an ssh session', () => {
    // What the remote actually sees: a TERM, and nothing that identifies the
    // terminal on the other end of the pipe.
    expect(caps({ SSH_TTY: '/dev/pts/3', SSH_CONNECTION: '10.0.0.1 22 10.0.0.2 22' }).clipboard).toBe(true);
  });

  it('is on inside tmux, which forwards it', () => {
    expect(caps({ TMUX: '/tmp/tmux-1000/default,1,0' }).clipboard).toBe(true);
  });

  it('is off under screen, which shows the payload as text', () => {
    expect(caps({ TERM: 'screen-256color' }).clipboard).toBe(false);
  });

  it('is off with no tty at all', () => {
    expect(detectCapabilities({ env: { TERM: 'xterm-256color' }, isTTY: false }).clipboard).toBe(false);
  });
});
