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
export { loadExtensions, resolveSpecifier } from './extensions.js';
export type { ExtensionContext, ExtensionModule, LoadOptions } from './extensions.js';
export { createReloader, STATUS_SEGMENTS } from './reload.js';
export type { Reloader, ReloaderOptions, ReloadOutcome, Registrar } from './reload.js';
export {
  EDITOR_LAYOUTS, EDITOR_MODE, GROUPS_PATH, GROUP_PATH, LAYOUT_PATH,
  activateTab, activeTab, allTabs, closeTab, focusGroup, focusedGroup, focusedIndex,
  PANE_SCOPES, layoutOf, openTab, openTabs, otherGroup, paneScope, readGroups,
  reconcileTabs, selectTab,
  setLayout, splitEditor, stepTab, tabFromPath, tabLabel, tabPath, unsplit,
} from './tabs.js';
export type { EditorLayout, Group } from './tabs.js';
export { REMEMBERED, seedSettings, rememberSettings } from './settings.js';
export {
  searchWorkspace, summarise, byFile,
  SEARCH_QUERY, SEARCH_RESULTS, SEARCH_STATE, SEARCH_SELECTED,
} from './search.js';
export type { Hit, SearchState, SearchOptions } from './search.js';
export { SearchResults } from './chrome/results.js';
export type { Remembered, SaveOptions } from './settings.js';
export { quitCommand } from './quit.js';
export type { QuitOptions } from './quit.js';
export { attachLog, fileSink, unixSink } from './log.js';
export type { LogSink, LogOptions } from './log.js';
export {
  Icon, mono, iconsFor, ICON_SETS, ICON_WIDTH_SAFE,
  FULL_ICONS, BMP_ICONS, ASCII_ICONS,
} from './icons.js';
export type { IconName, IconSet } from './icons.js';
