import type { Style, StatefulStyle, StyleInput, BorderSpec, BorderColor, BorderStyle, StyleColor, StateName } from '../types/style.js';
import type { ResolvedTheme } from '../types/theme.js';
import type { Edges } from '../types/geometry.js';
import type { Color } from '../types/cells.js';
import type { BorderChars } from '../types/style.js';
import {
  ATTR_BLINK, ATTR_BOLD, ATTR_DIM, ATTR_INVERSE, ATTR_ITALIC,
  ATTR_STRIKE, ATTR_UNDERLINE,
} from '../types/cells.js';
import { packColor, type PackedColor } from '../render/color.js';

/**
 * Style resolution.
 *
 * Five sources, merged in one fixed order so the answer to "why is this blue"
 * is always the same walk: the theme's entry for this component, the
 * component's own default, convenience props written inline, the `style` prop,
 * and finally the state overlay for focus, hover, active, selected, disabled.
 */

export const STYLE_KEYS = new Set<string>([
  'display', 'direction', 'gap', 'columnGap', 'rowGap', 'flexWrap', 'padding', 'margin',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'flex', 'shrink', 'basis', 'align', 'alignSelf', 'justify',
  'position', 'top', 'right', 'bottom', 'left', 'zIndex',
  'overflow', 'overflowX', 'overflowY',
  'fg', 'bg', 'bold', 'dim', 'italic', 'underline', 'inverse', 'strike', 'blink',
  'border', 'wrap', 'textAlign', 'fill', 'scrim', 'scrimStrength',
]);

export interface InteractionState {
  focused: boolean;
  hovered: boolean;
  /** Pressed. Not a selection - that is `selected`. */
  active: boolean;
  selected: boolean;
  disabled: boolean;
}

export const NO_INTERACTION: InteractionState = {
  focused: false, hovered: false, active: false, selected: false, disabled: false,
};

/**
 * The states, least to most specific - the order the last one wins.
 *
 * `flattenStyleInput` merges a `style` prop in this order and so does a
 * theme's per-component map, which is the only way the two can be made to
 * agree: a theme states `focus` over `selected` and gets the same answer
 * whether the state came from the node or from the theme. `hovered` is the
 * state; `hover` is the name it wears, which is why this is the one place
 * that has to know the difference.
 */
const STATE_ORDER: readonly (keyof InteractionState)[] = [
  'selected', 'hovered', 'active', 'focused', 'disabled',
];

const STATE_VARIANT: Record<keyof InteractionState, StateName> = {
  selected: 'selected',
  hovered: 'hover',
  active: 'active',
  focused: 'focus',
  disabled: 'disabled',
};

/** The names of the states that are true, in the order the last one wins. */
export function stateVariants(state: InteractionState): StateName[] {
  const out: StateName[] = [];
  for (const key of STATE_ORDER) {
    if (state[key]) out.push(STATE_VARIANT[key]);
  }
  return out;
}

function isStateful(value: Style | StatefulStyle): value is StatefulStyle {
  return (
    'base' in value || 'focus' in value || 'hover' in value ||
    'active' in value || 'selected' in value || 'disabled' in value
  );
}

export function mergeStyles(...styles: (Style | undefined)[]): Style {
  const out: Style = {};
  for (const style of styles) {
    if (!style) continue;
    Object.assign(out, style);
  }
  return out;
}

/** Flatten a `style` prop, applying state overlays in a fixed order. */
export function flattenStyleInput(input: StyleInput | undefined, state: InteractionState): Style {
  if (!input) return {};

  if (Array.isArray(input)) {
    return mergeStyles(...input.map((item) => (item ? flattenStyleInput(item, state) : undefined)));
  }

  if (!isStateful(input)) return input;

  // Order matters: selected loses to active, active loses to focus, and
  // disabled wins over everything - a disabled control is not focusable.
  // The same order `stateVariants` gives a theme, so the two cannot disagree.
  return mergeStyles(
    input.base,
    state.selected ? input.selected : undefined,
    state.hovered ? input.hover : undefined,
    state.active ? input.active : undefined,
    state.focused ? input.focus : undefined,
    state.disabled ? input.disabled : undefined,
  );
}

/** Pick the style keys written inline as convenience props. */
export function styleFromProps(props: Record<string, unknown>): Style {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (STYLE_KEYS.has(key) && props[key] !== undefined) out[key] = props[key];
  }
  return out as Style;
}

export function resolveStyle(
  props: Record<string, unknown>,
  theme: ResolvedTheme,
  component: string,
  defaultStyle: Style | undefined,
  state: InteractionState,
): Style {
  const qualifiers: string[] = [];
  if (typeof props.variant === 'string') qualifiers.push(props.variant);
  if (typeof props.tone === 'string') qualifiers.push(props.tone);
  if (typeof props.size === 'string') qualifiers.push(props.size);
  const variants: string[] = [...qualifiers];

  // The states join last, so a theme's entry for one of them wins over the
  // same name used as a variant - `List.focused` is the fill on the row the
  // keyboard is on, and a `focused` variant means nothing else.
  //
  // Each state is also offered qualified by each of the props-driven names,
  // immediately after the flat one, for the case the flat name cannot say:
  // whether a state paints at all is sometimes a property of a variant rather
  // than of the state. A solid tab is filled and an underline one is not, and
  // `Tabs.selected` has to mean the pair for both while `Tabs.solid.selected`
  // is the one that adds the fill. The qualified name merges last and the
  // order between the states is unchanged, so `disabled` still wins over
  // everything and `focus` still wins over `selected`.
  for (const name of stateVariants(state)) {
    variants.push(name);
    for (const qualifier of qualifiers) variants.push(`${qualifier}.${name}`);
  }

  // `styleAs` is how a component says which of its boxes a theme styles. A
  // list draws its rows as plain `box` nodes, so without it `components.List`
  // would be a key nothing ever reads - which is what every `components` entry
  // written for a composite component was until this.
  const owner = typeof props.styleAs === 'string' ? props.styleAs : component;

  return mergeStyles(
    theme.styleFor(owner, variants),
    defaultStyle,
    styleFromProps(props),
    flattenStyleInput(props.style as StyleInput | undefined, state),
  );
}

// ------------------------------------------------------------------ colour

/**
 * A token name, a literal colour, or nothing.
 *
 * Takes the whole union because it is the one place a colour is turned into
 * a cell value: the narrowing happened at the field that named it, which is
 * where the mistake is made and where the error belongs.
 */
export function resolveColor(
  value: StyleColor | undefined,
  theme: ResolvedTheme,
  fallback: Color = 'default',
): Color {
  if (value === undefined) return fallback;
  return theme.color(value as string);
}

/** Pack a colour for a cell, at the caller's own channel. */
export function packStyleColor(
  value: StyleColor | undefined,
  theme: ResolvedTheme,
  fallback: Color = 'default',
): PackedColor {
  return packColor(resolveColor(value, theme, fallback));
}

export function attrsFromStyle(style: Style): number {
  let attrs = 0;
  if (style.bold) attrs |= ATTR_BOLD;
  if (style.dim) attrs |= ATTR_DIM;
  if (style.italic) attrs |= ATTR_ITALIC;
  if (style.underline) attrs |= ATTR_UNDERLINE;
  if (style.inverse) attrs |= ATTR_INVERSE;
  if (style.strike) attrs |= ATTR_STRIKE;
  if (style.blink) attrs |= ATTR_BLINK;
  return attrs;
}

// ------------------------------------------------------------------ border

export interface ResolvedBorder {
  style: BorderStyle;
  chars: BorderChars;
  color: BorderColor | undefined;
  /** Per-edge overrides. Undefined here means "use `color`". */
  colors: { top?: BorderColor; right?: BorderColor; bottom?: BorderColor; left?: BorderColor };
  dim: boolean;
  sides: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  edges: Edges;
}

const NO_BORDER: ResolvedBorder = {
  style: 'none',
  chars: {
    topLeft: ' ', top: ' ', topRight: ' ', right: ' ', bottomRight: ' ',
    bottom: ' ', bottomLeft: ' ', left: ' ', cross: ' ',
    teeTop: ' ', teeBottom: ' ', teeLeft: ' ', teeRight: ' ',
  },
  color: undefined,
  colors: {},
  dim: false,
  sides: { top: false, right: false, bottom: false, left: false },
  edges: { top: 0, right: 0, bottom: 0, left: 0 },
};

export function resolveBorder(spec: BorderSpec | undefined, theme: ResolvedTheme): ResolvedBorder {
  if (spec === undefined) return NO_BORDER;

  const style = typeof spec === 'string' ? spec : spec.style ?? theme.border;
  if (style === 'none') return NO_BORDER;

  // Naming any side means naming all of them. `sides: { left: true }` has to
  // mean a left rule and nothing else - if unspecified sides defaulted to
  // true, every panel divider in every shell would draw a full box instead.
  const sidesSpec = typeof spec === 'string' ? undefined : spec.sides;
  const sides = sidesSpec
    ? {
        top: sidesSpec.top === true,
        right: sidesSpec.right === true,
        bottom: sidesSpec.bottom === true,
        left: sidesSpec.left === true,
      }
    : { top: true, right: true, bottom: true, left: true };

  const base = theme.borderChars(style);
  const chars = typeof spec === 'string' || !spec.chars ? base : { ...base, ...spec.chars };

  return {
    style,
    chars,
    color: typeof spec === 'string' ? undefined : spec.color,
    colors: typeof spec === 'string' ? {} : spec.colors ?? {},
    dim: typeof spec !== 'string' && spec.dim === true,
    sides,
    edges: {
      top: sides.top ? 1 : 0,
      right: sides.right ? 1 : 0,
      bottom: sides.bottom ? 1 : 0,
      left: sides.left ? 1 : 0,
    },
  };
}
