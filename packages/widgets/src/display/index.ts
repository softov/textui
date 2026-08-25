import type { ComponentDefinition } from '@textui/core';
import { Alert } from './alert.js';
import { Badge } from './badge.js';
import { Card } from './card.js';
import { ColorText } from './color-text.js';
import { EmptyState } from './empty-state.js';
import { ErrorState } from './error-state.js';
import { Heading } from './heading.js';
import { KeyValue } from './key-value.js';
import { Label } from './label.js';
import { Marquee } from './marquee.js';
import { Progress } from './progress.js';
import { Skeleton } from './skeleton.js';
import { Spinner } from './spinner.js';
import { StatusDot } from './status-dot.js';
import { Timeline } from './timeline.js';

/**
 * Display components.
 *
 * The rule that shapes all of them: **meaning never depends on colour alone.**
 * A degraded service is a different glyph as well as a different colour,
 * because a 16-colour ssh session, a colourblind reader and a piped log all
 * lose the colour and keep the glyph.
 */
export * from './alert.js';
export * from './badge.js';
export * from './card.js';
export * from './color-text.js';
export * from './empty-state.js';
export * from './error-state.js';
export * from './heading.js';
export * from './key-value.js';
export * from './label.js';
export * from './marquee.js';
export * from './progress.js';
export * from './skeleton.js';
export * from './spinner.js';
export * from './status-dot.js';
export * from './timeline.js';

export const DISPLAY_COMPONENTS: ComponentDefinition[] = [
  { component: 'Heading', category: 'display', renderer: { kind: 'function', render: Heading }, role: 'heading', description: 'Section heading, three levels.' },
  { component: 'Label', category: 'display', renderer: { kind: 'function', render: Label }, role: 'label', description: 'Secondary text with a semantic tone.' },
  { component: 'Badge', category: 'display', renderer: { kind: 'function', render: Badge }, variants: ['solid', 'outline', 'ghost'], description: 'Small status marker; carries a glyph as well as a colour.' },
  { component: 'StatusDot', category: 'display', renderer: { kind: 'function', render: StatusDot }, role: 'status', description: 'The shared status vocabulary: up, degraded, down.' },
  { component: 'Alert', category: 'feedback', renderer: { kind: 'function', render: Alert }, role: 'alert', description: 'A message with an icon and a tone.' },
  { component: 'Card', category: 'display', renderer: { kind: 'function', render: Card }, description: 'Bordered block with a title.' },
  { component: 'KeyValue', category: 'data', renderer: { kind: 'function', render: KeyValue }, description: 'Aligned label/value pairs.' },
  { component: 'Progress', category: 'feedback', renderer: { kind: 'function', render: Progress }, role: 'progressbar', description: 'Determinate or indeterminate bar, sub-cell resolution.' },
  { component: 'Spinner', category: 'feedback', renderer: { kind: 'function', render: Spinner }, role: 'status', description: 'Animated activity indicator.' },
  { component: 'ColorText', category: 'display', renderer: { kind: 'function', render: ColorText }, description: 'Multiline text coloured cell by cell - a ramp, a palette per line, or a function.' },
  { component: 'Marquee', category: 'display', renderer: { kind: 'function', render: Marquee }, role: 'marquee', description: 'Text too long for its box, read by sliding it while it has the cursor.' },
  { component: 'Skeleton', category: 'feedback', renderer: { kind: 'function', render: Skeleton }, description: 'Loading placeholder.' },
  { component: 'EmptyState', category: 'feedback', renderer: { kind: 'function', render: EmptyState }, description: 'Nothing here, and what to do about it.' },
  { component: 'ErrorState', category: 'feedback', renderer: { kind: 'function', render: ErrorState }, role: 'alert', description: 'A failure, with its message.' },
  { component: 'Timeline', category: 'data', renderer: { kind: 'function', render: Timeline }, description: 'Ordered events down a rail.' },
];
