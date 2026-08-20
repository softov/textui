/**
 * Adapters.
 *
 * Nothing here is registered by default. An adapter is a choice - the JSON one
 * decides that `.json` means a kind, two viewers and three transforms - and
 * choices belong to the application, not to the library that ships them.
 */
export {
  jsonAdapter, jsonHighlighter, scanJson, formatJson, minifyJson, sortJsonKeys,
  validateJson, ACTIVE_RESOURCE_PATH,
} from './json.js';
export type { JsonAdapterOptions, JsonFormatOptions, JsonProblem } from './json.js';
