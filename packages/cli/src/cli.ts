import { Cli } from './app.js';
import { COMMANDS } from './commands.js';

export const VERSION = '0.1.0';

export function createCli(options: { write?(t: string): void; writeError?(t: string): void } = {}): Cli {
  return new Cli({
    name: 'textui',
    version: VERSION,
    description: 'TextUI - build terminal interfaces you own.',
    commands: COMMANDS,
    globalOptions: [
      { name: 'cwd', type: 'string', description: 'Run as if from this directory' },
    ],
    write: options.write,
    writeError: options.writeError,
  });
}
