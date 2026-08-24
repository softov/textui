import type { BindingPath } from '@textui/core';
import { createContext } from '@textui/core';
import type { PanelHandle } from './resource-panel.js';

export const PanelContext = createContext<PanelHandle | null>('Panel', null);

/** Where a renderer with no panel keeps state, so the hook is always safe. */
export const LOOSE = '$/local/panel/loose' as BindingPath;
