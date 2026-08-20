import {
  Button, Column, KeyHints, Panel, Row, confirm, notify, prompt,
  useCommand, useExecute, useRuntime, useState, useTheme,
} from '@textui/core';

/**
 * Overlays.
 *
 * Every one of these goes through the layer manager rather than drawing itself
 * over its neighbours, which is why escape closes the right one and focus
 * comes back to where it was.
 *
 * The second thing this screen demonstrates is that a button and the command
 * palette are the same act. Nothing here has an `onPress` that opens anything:
 * the buttons execute commands, the palette lists those same commands, and a
 * keybinding would reach them too. Open the palette and run "Open a dialog" -
 * the dialog that appears is the one the button opens, because it is the same
 * command.
 */
export function OverlaysPlayground() {
  const runtime = useRuntime();
  const theme = useTheme();
  const execute = useExecute();
  const app = runtime.app();
  const [last, setLast] = useState('nothing yet');

  useCommand({
    id: 'overlay.dialog',
    title: 'Open a dialog',
    category: 'Overlays',
    description: 'A modal with a scrim, a trap and two actions.',
    keywords: ['modal', 'window'],
    slots: ['palette'],
    run: () => {
      app?.layers.open({
        id: 'demo-dialog',
        layer: 'modal',
        scrim: true,
        trapFocus: true,
        dismissOnEscape: true,
        node: {
          component: 'Dialog',
          title: 'A dialog',
          width: 44,
          children: {
            component: 'text',
            content: 'Composed by hand out of public components. Tab moves between the buttons.',
            wrap: 'word',
          },
          actions: [
            { id: 'ok', label: 'OK', tone: 'primary', onPress: { handler: () => { setLast('dialog: ok'); app.layers.close('demo-dialog'); } } },
            { id: 'cancel', label: 'Cancel', onPress: { handler: () => app.layers.close('demo-dialog') } },
          ],
        },
        onClose: (reason) => setLast(`dialog closed (${reason})`),
      });
    },
  }, [app]);

  useCommand({
    id: 'overlay.confirm',
    title: 'Ask for confirmation',
    category: 'Overlays',
    description: 'A yes/no dialog that resolves a promise.',
    slots: ['palette'],
    run: () => {
      if (!app) return;
      void confirm(app.layers, { message: 'Restart billing-worker?', tone: 'danger' })
        .then((ok) => setLast(`confirm: ${ok}`));
    },
  }, [app]);

  useCommand({
    id: 'overlay.prompt',
    title: 'Ask for a name',
    category: 'Overlays',
    description: 'A text field, an OK and a Cancel. Tab reaches all three.',
    slots: ['palette'],
    run: () => {
      if (!app) return;
      void prompt(app.layers, { title: 'Rename', message: 'New name', initialValue: 'billing-worker' })
        .then((value) => setLast(`prompt: ${value ?? 'cancelled'}`));
    },
  }, [app]);

  useCommand({
    id: 'overlay.palette',
    title: 'Open the command palette',
    category: 'Overlays',
    description: 'Which is itself a layer, and can open one.',
    slots: ['palette'],
    run: () => {
      app?.layers.open({
        id: 'demo-palette',
        layer: 'modal',
        trapFocus: true,
        dismissOnEscape: true,
        node: {
          component: 'CommandPalette',
          width: 60,
          onRun: { handler: (id: string) => setLast(`palette ran ${id}`) },
          onClose: { handler: () => app.layers.close('demo-palette') },
        },
      });
    },
  }, [app]);

  /**
   * A command with a choice, which is what gives the palette its second level.
   * The command says it needs a `tone` and what the tones are; the palette
   * asks. Nothing here knows that the palette exists.
   */
  useCommand({
    id: 'overlay.toast',
    title: 'Show a toast',
    category: 'Notifications',
    description: 'Transient, stacked on the notification layer.',
    slots: ['palette'],
    args: [{
      name: 'tone',
      type: 'string',
      required: true,
      description: 'How loud the toast should be.',
      choices: ['info', 'success', 'warning', 'danger'],
      default: 'info',
    }],
    run: (args) => {
      if (!app) return;
      const tone = String(args.tone ?? 'info') as 'info' | 'success' | 'warning' | 'danger';
      notify(app, { tone, title: tone, message: `A ${tone} toast` });
      setLast(`toast: ${tone}`);
    },
  }, [app]);

  /**
   * The choices can be a function, so they can come from a registry rather
   * than from a literal - here, whichever themes happen to be registered.
   */
  useCommand({
    id: 'overlay.theme',
    title: 'Switch theme',
    category: 'Appearance',
    description: 'The same list the theme registry holds.',
    slots: ['palette'],
    args: [{
      name: 'theme',
      type: 'string',
      required: true,
      description: 'Which registered theme to use.',
      choices: () => app?.themes.list().map((t) => t.id) ?? [],
    }],
    run: (args) => {
      const id = String(args.theme ?? '');
      if (!id || !app) return;
      app.setTheme(id);
      setLast(`theme: ${id}`);
    },
  }, [app]);

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Overlays" meta="every button runs a command">
        <Row gap={1}>
          <Button label="Dialog" onPress={() => execute('overlay.dialog')} autoFocus />
          <Button label="Palette" onPress={() => execute('overlay.palette')} />
          <Button label="Confirm" onPress={() => execute('overlay.confirm')} />
          <Button label="Prompt" onPress={() => execute('overlay.prompt')} />
        </Row>
      </Panel>

      <Panel title="Toasts" meta="one command, an argument each">
        <Row gap={1}>
          <Button label="Info" onPress={() => execute('overlay.toast', { tone: 'info' })} />
          <Button label="Success" tone="success" onPress={() => execute('overlay.toast', { tone: 'success' })} />
          <Button label="Danger" tone="danger" onPress={() => execute('overlay.toast', { tone: 'danger' })} />
        </Row>
      </Panel>

      <Panel title="Last result">
        <text content={last} fg="accent" />
      </Panel>

      <KeyHints
        height={1}
        hints={[
          { keys: 'tab', label: 'move' },
          { keys: 'enter', label: 'press' },
          { keys: theme.glyphs.chevronRight, label: 'sub-items' },
          { keys: 'esc', label: 'close' },
        ]}
      />
    </Column>
  );
}
