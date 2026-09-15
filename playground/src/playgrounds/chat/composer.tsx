import { useApp, useCapabilities, useState } from '@textui/core';
import type { Rect, TextUIApp, UnicodeLevel } from '@textui/core';
import { ChatComposer, openPicker, settingIcon, valueIcon } from '@textui/chat';
import type { ChatCommand, ChatCompletion, ComposerOption } from '@textui/chat';
import { Column, KeyValue, Panel } from '@textui/widgets';

const COMMANDS: ChatCommand[] = [
  { id: 'theme', kind: 'client', title: 'Theme', description: 'Pick a theme' },
  { id: 'model', kind: 'client', title: 'Model', description: 'Pick a model' },
  { id: 'review', kind: 'session', title: 'Review', description: 'Review the branch', from: 'textui-plugin' },
];

const PATHS: ChatCompletion[] = [
  'src/index.ts', 'src/bubble.tsx', 'src/composer.tsx', 'src/hitl.tsx', 'src/sessions.tsx', 'src/transcript.tsx',
  'test/bubble.test.tsx', 'test/composer.test.tsx',
].map((path) => ({ insertText: `@${path}`, label: path, rangeStart: 0, rangeEnd: 1 }));

// The marks come from the same helpers an application uses, so they follow
// the terminal down to ascii with everything else.
const options = (unicode: UnicodeLevel): ComposerOption[] => [
  { id: 'harness', label: 'claude', title: 'Harness', icon: settingIcon(unicode, 'harness'), commandId: 'compose.set.harness' },
  { id: 'mode', label: 'Plan only', title: 'Approval mode', icon: valueIcon(unicode, 'plan') ?? '', commandId: 'compose.set.mode' },
  { id: 'workspace', label: '~/textui', title: 'Workspace', icon: settingIcon(unicode, 'workspace') },
];

/**
 * The composer.
 *
 * A slash opens the command menu and an at-sign the path menu; the chips
 * open the picker over their own command. What was sent, what was cancelled
 * and where the box is are all reported above it, since they are all the
 * application ever hears.
 */
export function ComposerPlayground() {
  const app = useApp();
  const [value, setValue] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [picked, setPicked] = useState('');
  const unicode = useCapabilities().unicode;

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Heard" flex={1}>
        <KeyValue items={[
          { label: 'Sent', value: sent.join(' · ') || '(nothing yet)' },
          { label: 'Running', value: running ? 'yes, enter queues' : 'no' },
          { label: 'Picked', value: picked || '(nothing yet)' },
          { label: 'Box', value: rect ? `y ${rect.y}, ${rect.width}x${rect.height}` : '' },
        ]} />
      </Panel>
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={(text) => { setSent([...sent, text]); setValue(''); setRunning(!running); }}
        onCancel={() => setRunning(false)}
        running={running}
        queued={running ? 1 : 0}
        options={options(unicode)}
        onOption={(option, anchorId) => { if (option.commandId) openPicker(app, { commandId: option.commandId, anchorId }); }}
        commands={COMMANDS}
        onCommand={(command) => { setPicked(`/${command.id}`); setValue(''); }}
        paths={value.startsWith('@') ? PATHS : []}
        onPath={(path) => { setValue(`${value.slice(0, path.rangeStart)}${path.insertText} `); }}
        onMeasure={setRect}
        placeholder="Say something · / for commands · @ for paths"
        autoFocus
      />
    </Column>
  );
}

/** The two chip commands, so the picker has something to open on. */
export function setupComposerPlayground(app: TextUIApp): void {
  app.commands.register({
    id: 'compose.set.harness',
    title: 'Harness',
    slots: ['palette'],
    args: [{ name: 'value', type: 'string', required: true, choices: [
      { value: 'claude', label: 'claude' }, { value: 'codex', label: 'codex' },
    ] }],
    run: () => {},
  });
  app.commands.register({
    id: 'compose.set.mode',
    title: 'Approval mode',
    slots: ['palette'],
    args: [{ name: 'value', type: 'string', required: true, choices: [
      { value: 'plan', label: 'Plan only', description: 'Reads, never writes' },
      { value: 'edits', label: 'Accept edits', description: 'Writes files, asks before commands' },
      { value: 'bypass', label: 'Bypass', description: 'Asks about nothing' },
    ] }],
    run: () => {},
  });
}
