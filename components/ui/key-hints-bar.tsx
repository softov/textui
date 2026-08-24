import { defineComponent, useRuntime, type BoxProps } from '@textui/core';
import { KeyHints } from '@textui/widgets';

/**
 * The footer line, built from the command registry rather than a hand-kept
 * list - so a command that gains a keybinding shows up here without anyone
 * remembering to add it, and one that is disabled by its `when` clause
 * disappears.
 */
export interface KeyHintsBarProps extends BoxProps {
  /** Command ids to show, in order. Omit for everything in the `hints` slot. */
  commands?: string[];
}

export function KeyHintsBar({ commands, ...rest }: KeyHintsBarProps) {
  const runtime = useRuntime();
  const app = runtime.app();
  if (!app) return null;

  const chosen = commands
    ? commands.map((id) => app.commands.get(id)).filter((c) => c !== undefined)
    : app.commands.list({ slot: 'hints', enabledOnly: true });

  const hints = chosen
    .map((command) => ({
      keys: app.keybindings.forCommand(command.id)[0],
      label: command.title.toLowerCase(),
    }))
    .filter((hint): hint is { keys: string; label: string } => hint.keys !== undefined);

  return <KeyHints hints={hints} {...rest} />;
}

export default defineComponent('KeyHintsBar', KeyHintsBar);
