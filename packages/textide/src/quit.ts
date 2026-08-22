import type { CommandDefinition, TextUIApp } from '@textui/core';
import { confirm } from '@textui/core';
import { openDocuments } from '@textui/documents';

/**
 * Leaving.
 *
 * Its own file because it stopped being one line the moment it had to ask a
 * question, and because a command that can lose an afternoon's work is worth a
 * test - which means it cannot live inside the boot closure that owns the
 * terminal.
 *
 * Quit is two keystrokes from anywhere: it is the last entry in the File menu,
 * so it is one `up` from the first the moment that menu opens. It used to exit
 * the process on the spot.
 *
 * It always asks now, not only when something is unsaved. `ctrl+c` is bound to
 * it, and in every other terminal program `ctrl+c` means interrupt - so it
 * gets pressed by muscle memory at a shell prompt that turned out to be an
 * editor, and losing a session that way costs more than one keypress ever
 * saves. The question when there *is* unsaved work is a different and louder
 * one: it names the files and its confirm is the dangerous button.
 */
export interface QuitOptions {
  /** What leaving actually does. Injected, so a test can watch it not happen. */
  exit(): Promise<void> | void;
}

export function quitCommand(app: TextUIApp, options: QuitOptions): CommandDefinition {
  return {
    id: 'app.quit',
    title: 'Quit',
    slots: ['palette', 'hints'],
    run: async () => {
      const unsaved = openDocuments(app.store).filter((doc) => doc.content !== doc.original);
      if (unsaved.length === 0) {
        const ok = await confirm(app.layers, {
          title: 'Quit',
          message: 'Quit textide?',
          confirmLabel: 'Quit',
          cancelLabel: 'Stay',
        });
        if (!ok) return;
      } else {
        // Named, because "you have unsaved changes" leaves you to guess which
        // file and whether you care - and the answer is usually one file.
        const names = unsaved.map((doc) => doc.uri.split('/').pop() ?? doc.uri);
        const ok = await confirm(app.layers, {
          title: 'Quit',
          message: unsaved.length === 1
            ? `${names[0] as string} has unsaved changes.`
            : `${unsaved.length} files have unsaved changes: ${names.join(', ')}`,
          confirmLabel: 'Discard and quit',
          cancelLabel: 'Stay',
          tone: 'danger',
        });
        if (!ok) return;
      }
      await options.exit();
    },
  };
}
