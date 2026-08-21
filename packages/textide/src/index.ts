/**
 * textide.
 *
 * An IDE that happens to run in a terminal. The application is exported as
 * well as run, so its screen can be mounted by a test - and so another
 * application can host it, the same way it will host git.
 */
export { Explorer, Editor } from './app.js';
export { registerTextide } from './register.js';
export type { RegisterOptions } from './register.js';
export {
  createFilesystemProvider, filesystemAdapter, uriToPath, pathToUri,
  extensionOf, ACTIVE_PATH,
} from './filesystem.js';
export type { FilesystemOptions } from './filesystem.js';
export { loadWorkspace, seedWorkspace, WORKSPACE_PATH, CONFIG_FILE } from './workspace.js';
export type { Workspace, WorkspaceConfig } from './workspace.js';
export { TitleBar } from './chrome/titlebar.js';
export { StatusLine } from './chrome/statusbar.js';
export { MenuBar, MENUS } from './chrome/menubar.js';
export { textideCommands, paletteOrder, layoutCommands, EDITOR_URI, CATEGORIES, TOGGLE_COMMAND } from './commands.js';
export { attachLog, fileSink, unixSink } from './log.js';
export type { LogSink, LogOptions } from './log.js';
export {
  Icon, mono, iconsFor, ICON_SETS, ICON_WIDTH_SAFE,
  FULL_ICONS, BMP_ICONS, ASCII_ICONS,
} from './icons.js';
export type { IconName, IconSet } from './icons.js';
