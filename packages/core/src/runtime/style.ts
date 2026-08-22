import type { Style, StatefulStyle, StyleInput, BorderSpec, BorderStyle, StyleColor } from '../types/style.js';
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
  active: boolean;
  selected: boolean;
  disabled: boolean;
}

export const NO_INTERACTION: InteractionState = {
  focused: false, hovered: false, active: false, selected: false, disabled: false,
};

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
  const variants: string[] = [];
  if (typeof props.variant === 'string') variants.push(props.variant);
  if (typeof props.tone === 'string') variants.push(props.tone);
  if (typeof props.size === 'string') variants.push(props.size);

  return mergeStyles(
    theme.styleFor(component, variants),
    defaultStyle,
    styleFromProps(props),
    flattenStyleInput(props.style as StyleInput | undefined, state),
  );
}

// ------------------------------------------------------------------ colour

/** A token name, a literal colour, or nothing. */
export function resolveColor(
  value: StyleColor | undefined,
  theme: ResolvedTheme,
  fallback: Color = 'default',
): Color {
  if (value === undefined) return fallback;
  return theme.color(value as string);
}

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
  color: StyleColor | undefined;
  /** Per-edge overrides. Undefined here means "use `color`". */
  colors: { top?: StyleColor; right?: StyleColor; bottom?: StyleColor; left?: StyleColor };
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
