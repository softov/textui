import type { Disposable, RenderOutput, TextUIApp } from '@textui/core';
import {
  createBag, defineComponent, useKeymap, useStore, useStoreValue, useTheme,
} from '@textui/core';
import {
  ColorText, KeyHints, List, ScrollView, Select, TextArea, registerBuiltins,
} from '@textui/widgets';
import { FONTS, banner, fillGlyphs, fontAt } from './fonts.js';
import { PRESETS, sample } from './inks.js';

/**
 * A field, a panel, and one component doing all the colouring.
 *
 * The demo is a banner because a banner is where per-cell colour earns its
 * keep, but the point of it is the switch marked `plain`: the same
 * `<ColorText>` and the same inks render ordinary prose, and neither knows
 * which it is looking at. A ramp across five rows of block letters and a ramp
 * across a wrapped paragraph are one component.
 *
 * State lives in the store rather than in `useState`, so the field, the panel
 * and the footer are all reading one answer to "what is being shown". Three
 * copies of it would be three chances to disagree.
 */

export const TEXT = '$/ink/text';
export const PRESET = '$/ink/preset';
export const FONT = '$/ink/font';
export const PLAIN = '$/ink/plain';
export const WRAP = '$/ink/wrap';

const DEFAULT_TEXT = 'TextUI\nink';
const FIRST_INK = PRESETS[1]?.id ?? 'none';
const FIRST_FONT = FONTS[0]?.id ?? 'block';

/** Long enough that the panel has to scroll, which is the other thing to try. */
const PROSE = [
  'Colour is decoration and never the message. A sixteen-colour session flattens a six-stop ramp into a couple of bands, a piped log loses all of it, and the words have to survive both.',
  'Nothing here knows it is prose rather than a banner. The component was handed a string with newlines in it, asked its ink for a colour per cell, and painted the characters it was given - which is the same thing it does to five rows of block letters.',
  'What changes between the two is the wrapping. A banner does not wrap, because breaking a line of block letters in half breaks the letters; a paragraph does, and then the ink runs over the lines the wrap produced rather than the ones that were typed.',
].join('\n\n');

function presetAt(id: string): (typeof PRESETS)[number] {
  return PRESETS.find((p) => p.id === id) ?? (PRESETS[0] as (typeof PRESETS)[number]);
}

/** The block the ink is applied to: block letters, or the prose that shows it is not a banner component. */
const Subject = defineComponent<Record<string, never>>('InkSubject', () => {
  const theme = useTheme();
  const text = useStoreValue<string>(TEXT, DEFAULT_TEXT) ?? DEFAULT_TEXT;
  const plain = useStoreValue<boolean>(PLAIN, false) ?? false;
  const wrap = useStoreValue<boolean>(WRAP, true) ?? true;
  const preset = presetAt(useStoreValue<string>(PRESET, FIRST_INK) ?? FIRST_INK);
  const font = fontAt(useStoreValue<string>(FONT, FIRST_FONT) ?? FIRST_FONT);

  const { fill, shade } = fillGlyphs(theme.glyphs);
  const content = plain
    ? `${text}\n\n${PROSE}`
    : banner(text || DEFAULT_TEXT, font, fill, shade);

  return (
    <ColorText
      content={content}
      ink={preset.ink}
      fg="muted"
      wrap={plain && wrap ? 'word' : 'none'}
      textAlign={plain ? 'left' : 'center'}
      alignBlock={!plain}
    />
  );
});

/** The inks, and the fonts, down the side. */
const Sidebar = defineComponent<Record<string, never>>('InkSidebar', () => {
  const [ink, setInk] = useStore<string>(PRESET, FIRST_INK);
  const [font, setFont] = useStore<string>(FONT, FIRST_FONT);
  const plain = useStoreValue<boolean>(PLAIN, false) ?? false;

  return (
    <box direction="column" width={24} gap={1}>
      <List
        flex={1}
        title="ink"
        border="single"
        items={PRESETS.map((p) => ({ id: p.id, label: p.title }))}
        selectedId={ink}
        onSelect={(id) => setInk(id)}
        focusId="inks"
        autoFocus
      />
      {/* A select rather than a second list, and floating rather than inline:
        * the sidebar is one column of a short terminal, and a second bordered
        * list would take six rows the ink list does not have to give. Gone
        * altogether in plain mode - there is no font to pick when the text is
        * being drawn as itself, and a control that answers to the keyboard and
        * changes nothing is worse than one that is absent. */}
      {plain ? null : (
        <Select
          label="font"
          mode="floating"
          border="single"
          options={FONTS.map((f) => ({ value: f.id, label: f.title }))}
          value={font}
          onChange={(id) => setFont(id)}
        />
      )}
    </box>
  );
});

/**
 * The strip of colour under the field.
 *
 * A `ColorText` of nothing but full blocks, which is all a swatch is - and a
 * reminder that the component has no idea the other one is drawing letters.
 */
const Swatch = defineComponent<{ width: number }>('InkSwatch', ({ width }) => {
  const { fill } = fillGlyphs(useTheme().glyphs);
  return <ColorText content={fill.repeat(width)} ink={sample(width)} />;
});

/** What the selected ink and font are doing, spelled out. */
const Note = defineComponent<Record<string, never>>('InkNote', () => {
  const preset = presetAt(useStoreValue<string>(PRESET, FIRST_INK) ?? FIRST_INK);
  const font = fontAt(useStoreValue<string>(FONT, FIRST_FONT) ?? FIRST_FONT);
  const plain = useStoreValue<boolean>(PLAIN, false) ?? false;

  return (
    <box direction="column" maxHeight={4} overflow="hidden">
      <text content={preset.note} wrap="word" fg="muted" />
      {plain ? null : <text content={`${font.title}: ${font.note}`} wrap="word" fg="subtle" />}
    </box>
  );
});

// Annotated because it is exported: without it the inferred type names a
// path into `node_modules`, which is not a type a consumer could write down.
const Frame: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('InkFrame', () => {
    const [text, setText] = useStore<string>(TEXT, DEFAULT_TEXT);
    const [plain, setPlain] = useStore<boolean>(PLAIN, false);
    const [wrap, setWrap] = useStore<boolean>(WRAP, true);

    // Chords rather than letters. The field takes every printable key, so a
    // bare `p` while it has focus has to type a `p` - a hint that says
    // otherwise is a hint that is wrong half the time.
    useKeymap({
      'ctrl+p': () => setPlain(!plain),
      'ctrl+w': () => setWrap(!wrap),
    });

    return (
      <box direction="column" flex={1} padding={1} gap={1}>
        {/* Multi-line, because a banner is not always one word. Enter inserts
          * a newline here - no `onSubmit`, so there is nothing for it to do
          * instead - and every line typed becomes its own block of letters. */}
        <box direction="column">
          <TextArea
            value={text ?? DEFAULT_TEXT}
            onChange={setText}
            maxRows={4}
            border="round"
            title="text"
            padding={[0, 1]}
            placeholder="type something, enter for a second line"
            focusId="text"
          />
          <Swatch width={24} />
        </box>
        <box direction="row" flex={1} gap={1}>
          <Sidebar />
          {/* The panel scrolls. A banner in a font twice as tall as the last
            * one, or three paragraphs of prose in a short terminal, is more
            * than the panel holds - and clipping it silently would be the
            * component looking broken rather than the panel being small. */}
          <ScrollView
            flex={1}
            border="round"
            title={plain ? 'plain text' : 'banner'}
            padding={[0, 1]}
            scrollbar
            focusId="panel"
          >
            <Subject />
          </ScrollView>
        </box>
        <Note />
        <KeyHints
          hints={[
            { keys: 'tab', label: 'move' },
            { keys: '↑↓', label: 'pick' },
            { keys: 'ctrl+p', label: plain ? 'banner' : 'plain' },
            ...(plain ? [{ keys: 'ctrl+w', label: wrap ? 'no wrap' : 'wrap' }] : []),
            { keys: 'ctrl+c', label: 'quit' },
          ]}
        />
      </box>
    );
  });

/**
 * Everything the app needs registered, in one call a test can make too.
 *
 * `ColorText` is in the catalog already, and `registerBuiltins` puts the
 * catalog in - so nothing here registers it. `InkFrame` needs the line because
 * `root` names it by string, and a name is looked up whoever wrote it. The
 * components it renders need no line at all: JSX puts the function on the
 * node, and a node carrying a function is not a registry lookup.
 */
export function registerInk(app: TextUIApp): Disposable {
  const bag = createBag();
  bag.add(registerBuiltins(app));
  bag.add(app.components.register({
    component: 'InkFrame',
    category: 'chrome',
    renderer: { kind: 'function', render: Frame },
  }));
  return bag;
}

export { Frame };
