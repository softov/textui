import { stringWidth } from '@textui/core';

/**
 * CLI application primitives.
 *
 * Deliberately small: commands, options, help, and prompts. The point is not
 * to replace a full CLI ecosystem - it is that an application built on TextUI
 * should be able to combine plain commands with interactive screens without
 * reaching for a second framework and a second idea of what an argument is.
 */

export type OptionType = 'string' | 'number' | 'boolean';

export interface OptionSpec {
  name: string;
  type?: OptionType;
  /** Single-letter alias: `-w`. */
  short?: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  /** Accept the flag more than once, collecting values. */
  multiple?: boolean;
  choices?: string[];
}

export interface ArgumentSpec {
  name: string;
  description?: string;
  required?: boolean;
  /** Swallow the rest of the command line. */
  variadic?: boolean;
}

export interface ParsedArgs {
  options: Record<string, unknown>;
  positionals: string[];
  /** Everything after a bare `--`. */
  rest: string[];
}

export interface CliCommand {
  name: string;
  description?: string;
  aliases?: string[];
  arguments?: ArgumentSpec[];
  options?: OptionSpec[];
  /** Subcommands. A command with children may still have a handler. */
  commands?: CliCommand[];
  examples?: string[];
  hidden?: boolean;
  run?(args: ParsedArgs, cli: Cli): Promise<number | void> | number | void;
}

export interface CliOptions {
  name: string;
  version?: string;
  description?: string;
  commands: CliCommand[];
  /** Options accepted before the command name. */
  globalOptions?: OptionSpec[];
  /** Where output goes. Swappable so tests can capture it. */
  write?(text: string): void;
  writeError?(text: string): void;
}

export class CliError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
    this.name = 'CliError';
  }
}

const HELP_OPTION: OptionSpec = { name: 'help', short: 'h', type: 'boolean', description: 'Show this help' };
const VERSION_OPTION: OptionSpec = { name: 'version', short: 'v', type: 'boolean', description: 'Print the version' };

export class Cli {
  readonly name: string;
  readonly version: string;

  constructor(private options: CliOptions) {
    this.name = options.name;
    this.version = options.version ?? '0.0.0';
  }

  write(text: string): void {
    (this.options.write ?? ((t: string) => process.stdout.write(t)))(text);
  }

  writeError(text: string): void {
    (this.options.writeError ?? ((t: string) => process.stderr.write(t)))(text);
  }

  /** Run and return an exit code. Never throws for a user-facing problem. */
  async run(argv: string[]): Promise<number> {
    try {
      return await this.dispatch(argv);
    } catch (err) {
      if (err instanceof CliError) {
        this.writeError(`${this.name}: ${err.message}\n`);
        return err.exitCode;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.writeError(`${this.name}: ${message}\n`);
      return 1;
    }
  }

  private async dispatch(argv: string[]): Promise<number> {
    const path: CliCommand[] = [];
    let commands = this.options.commands;
    let index = 0;

    while (index < argv.length) {
      const token = argv[index] as string;
      if (token.startsWith('-')) break;
      const found = commands.find(
        (c) => c.name === token || (c.aliases ?? []).includes(token),
      );
      if (!found) break;
      path.push(found);
      commands = found.commands ?? [];
      index++;
    }

    const command = path[path.length - 1];
    const rest = argv.slice(index);

    // Help and version are answered before anything is validated, because a
    // user asking for help has by definition not got the arguments right yet.
    if (rest.includes('--help') || rest.includes('-h')) {
      this.write(this.help(path));
      return 0;
    }
    if (path.length === 0 && (rest.includes('--version') || rest.includes('-v'))) {
      this.write(`${this.version}\n`);
      return 0;
    }
    if (!command) {
      this.write(this.help([]));
      return argv.length === 0 ? 0 : 1;
    }
    if (!command.run) {
      this.write(this.help(path));
      return 1;
    }

    const specs = [
      ...(this.options.globalOptions ?? []),
      ...(command.options ?? []),
      HELP_OPTION,
    ];
    const parsed = parseArgs(rest, specs);
    validate(command, parsed);

    const code = await command.run(parsed, this);
    return typeof code === 'number' ? code : 0;
  }

  help(path: CliCommand[] = []): string {
    const command = path[path.length - 1];
    const lines: string[] = [];

    if (!command) {
      lines.push(this.options.description ?? `${this.name} ${this.version}`);
      lines.push('');
      lines.push(`Usage: ${this.name} <command> [options]`);
      lines.push('');
      lines.push('Commands:');
      lines.push(...describeCommands(this.options.commands));
      if (this.options.globalOptions?.length) {
        lines.push('');
        lines.push('Options:');
        lines.push(...describeOptions([...this.options.globalOptions, HELP_OPTION, VERSION_OPTION]));
      }
      lines.push('');
      lines.push(`Run \`${this.name} <command> --help\` for details.`);
      return lines.join('\n') + '\n';
    }

    const names = path.map((c) => c.name).join(' ');
    const args = (command.arguments ?? [])
      .map((a) => (a.required ? `<${a.name}${a.variadic ? '...' : ''}>` : `[${a.name}${a.variadic ? '...' : ''}]`))
      .join(' ');

    if (command.description) {
      lines.push(command.description);
      lines.push('');
    }
    lines.push(`Usage: ${this.name} ${names}${args ? ` ${args}` : ''} [options]`);

    if (command.arguments?.length) {
      lines.push('');
      lines.push('Arguments:');
      const width = Math.max(...command.arguments.map((a) => stringWidth(a.name)));
      for (const arg of command.arguments) {
        lines.push(`  ${arg.name.padEnd(width)}  ${arg.description ?? ''}`.trimEnd());
      }
    }

    if (command.commands?.length) {
      lines.push('');
      lines.push('Commands:');
      lines.push(...describeCommands(command.commands));
    }

    const options = [...(command.options ?? []), HELP_OPTION];
    lines.push('');
    lines.push('Options:');
    lines.push(...describeOptions(options));

    if (command.examples?.length) {
      lines.push('');
      lines.push('Examples:');
      for (const example of command.examples) lines.push(`  ${example}`);
    }

    return lines.join('\n') + '\n';
  }
}

function describeCommands(commands: CliCommand[]): string[] {
  const visible = commands.filter((c) => !c.hidden);
  if (visible.length === 0) return ['  (none)'];
  const width = Math.max(...visible.map((c) => stringWidth(c.name)));
  return visible.map((c) => `  ${c.name.padEnd(width)}  ${c.description ?? ''}`.trimEnd());
}

function describeOptions(options: OptionSpec[]): string[] {
  const labels = options.map((o) => {
    const short = o.short ? `-${o.short}, ` : '    ';
    const value = o.type === 'boolean' || o.type === undefined ? '' : ` <${o.type}>`;
    return `${short}--${o.name}${value}`;
  });
  const width = Math.max(...labels.map(stringWidth));
  return options.map((o, i) => {
    const extra: string[] = [];
    if (o.choices) extra.push(`(${o.choices.join(' | ')})`);
    if (o.default !== undefined) extra.push(`[default: ${String(o.default)}]`);
    const suffix = extra.length ? ` ${extra.join(' ')}` : '';
    return `  ${(labels[i] as string).padEnd(width)}  ${o.description ?? ''}${suffix}`.trimEnd();
  });
}

/**
 * Parse a command line.
 *
 * Supports `--flag`, `--no-flag`, `--key value`, `--key=value`, `-k value`,
 * bundled short flags `-abc`, and `--` to stop parsing. Unknown options are an
 * error rather than a positional, because a typo silently becoming a filename
 * is how a CLI deletes the wrong thing.
 */
export function parseArgs(argv: string[], specs: OptionSpec[]): ParsedArgs {
  const byName = new Map(specs.map((s) => [s.name, s]));
  const byShort = new Map(specs.filter((s) => s.short).map((s) => [s.short as string, s]));

  const options: Record<string, unknown> = {};
  const positionals: string[] = [];
  const rest: string[] = [];

  for (const spec of specs) {
    if (spec.default !== undefined) options[spec.name] = spec.default;
    else if (spec.type === 'boolean') options[spec.name] = false;
  }

  const assign = (spec: OptionSpec, raw: string | boolean): void => {
    const value = coerce(spec, raw);
    if (spec.choices && typeof value === 'string' && !spec.choices.includes(value)) {
      throw new CliError(
        `--${spec.name} must be one of: ${spec.choices.join(', ')} (got "${value}")`,
      );
    }
    if (spec.multiple) {
      const list = Array.isArray(options[spec.name]) ? (options[spec.name] as unknown[]) : [];
      options[spec.name] = [...list, value];
      return;
    }
    options[spec.name] = value;
  };

  let i = 0;
  while (i < argv.length) {
    const token = argv[i] as string;

    if (token === '--') {
      rest.push(...argv.slice(i + 1));
      break;
    }

    if (token.startsWith('--')) {
      const body = token.slice(2);
      const eq = body.indexOf('=');
      const name = eq === -1 ? body : body.slice(0, eq);
      const inline = eq === -1 ? undefined : body.slice(eq + 1);

      if (name.startsWith('no-') && byName.has(name.slice(3))) {
        assign(byName.get(name.slice(3)) as OptionSpec, false);
        i++;
        continue;
      }

      const spec = byName.get(name);
      if (!spec) throw new CliError(`unknown option --${name}`);

      if (spec.type === 'boolean' || spec.type === undefined) {
        assign(spec, inline === undefined ? true : inline !== 'false');
        i++;
        continue;
      }

      const value = inline ?? argv[i + 1];
      if (value === undefined) throw new CliError(`--${name} needs a value`);
      assign(spec, value);
      i += inline === undefined ? 2 : 1;
      continue;
    }

    if (token.startsWith('-') && token.length > 1) {
      const letters = [...token.slice(1)];
      for (let j = 0; j < letters.length; j++) {
        const letter = letters[j] as string;
        const spec = byShort.get(letter);
        if (!spec) throw new CliError(`unknown option -${letter}`);

        if (spec.type === 'boolean' || spec.type === undefined) {
          assign(spec, true);
          continue;
        }
        // A value-taking short flag consumes the rest of the bundle, or the
        // next argument: `-w80` and `-w 80` both work.
        const inline = letters.slice(j + 1).join('');
        const value = inline !== '' ? inline : argv[++i];
        if (value === undefined) throw new CliError(`-${letter} needs a value`);
        assign(spec, value);
        break;
      }
      i++;
      continue;
    }

    positionals.push(token);
    i++;
  }

  return { options, positionals, rest };
}

function coerce(spec: OptionSpec, raw: string | boolean): unknown {
  if (typeof raw === 'boolean') return raw;
  if (spec.type === 'number') {
    const n = Number(raw);
    if (Number.isNaN(n)) throw new CliError(`--${spec.name} must be a number (got "${raw}")`);
    return n;
  }
  if (spec.type === 'boolean') return raw !== 'false';
  return raw;
}

function validate(command: CliCommand, parsed: ParsedArgs): void {
  for (const spec of command.options ?? []) {
    if (spec.required && parsed.options[spec.name] === undefined) {
      throw new CliError(`--${spec.name} is required`);
    }
  }
  const required = (command.arguments ?? []).filter((a) => a.required);
  if (parsed.positionals.length < required.length) {
    const missing = required.slice(parsed.positionals.length).map((a) => a.name);
    throw new CliError(`missing argument: ${missing.join(', ')}`);
  }
}

// ------------------------------------------------------------------ prompts

export interface PromptOptions {
  message: string;
  default?: string;
  /** Hide what is typed. */
  mask?: boolean;
  validate?(value: string): string | null;
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
}

/**
 * A line prompt for non-interactive stretches of a CLI.
 *
 * This is deliberately not a TUI: mixing a full-screen renderer into a prompt
 * means a resize or a stray escape sequence can eat the answer. When the input
 * is not a terminal it returns the default rather than hanging, which is what
 * makes a CLI usable from a script.
 */
export async function promptLine(options: PromptOptions): Promise<string> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  const suffix = options.default ? ` (${options.default})` : '';
  if (!input.isTTY) return options.default ?? '';

  for (;;) {
    output.write(`${options.message}${suffix}: `);
    const answer = await readLine(input, options.mask ? output : undefined);
    const value = answer.trim() === '' ? options.default ?? '' : answer.trim();

    const problem = options.validate?.(value);
    if (!problem) {
      if (options.mask) output.write('\n');
      return value;
    }
    output.write(`  ${problem}\n`);
  }
}

export async function promptConfirm(
  message: string,
  options: { default?: boolean; input?: NodeJS.ReadStream; output?: NodeJS.WriteStream } = {},
): Promise<boolean> {
  const fallback = options.default ?? false;
  const answer = await promptLine({
    message: `${message} ${fallback ? '[Y/n]' : '[y/N]'}`,
    default: fallback ? 'y' : 'n',
    input: options.input,
    output: options.output,
  });
  return /^y(es)?$/i.test(answer);
}

export async function promptSelect(
  message: string,
  choices: { value: string; label: string }[],
  options: { input?: NodeJS.ReadStream; output?: NodeJS.WriteStream } = {},
): Promise<string> {
  const output = options.output ?? process.stdout;
  output.write(`${message}\n`);
  choices.forEach((choice, i) => output.write(`  ${i + 1}) ${choice.label}\n`));

  const answer = await promptLine({
    message: `Choose 1-${choices.length}`,
    default: '1',
    input: options.input,
    output,
    validate: (value: string) => {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= choices.length ? null : 'Out of range';
    },
  });
  return (choices[Number(answer) - 1] as { value: string }).value;
}

const CTRL_C = String.fromCharCode(3);
const BACKSPACE = String.fromCharCode(8);
const DEL = String.fromCharCode(127);

function readLine(input: NodeJS.ReadStream, maskTo?: NodeJS.WriteStream): Promise<string> {
  return new Promise((resolve) => {
    let buffer = '';
    const wasRaw = input.isRaw;

    const finish = (): void => {
      input.off('data', onData);
      if (maskTo && wasRaw === false && input.setRawMode) input.setRawMode(false);
      input.pause();
      resolve(buffer);
    };

    const onData = (chunk: Buffer | string): void => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      for (const char of text) {
        if (char === '\n' || char === '\r') return finish();
        // ctrl+c during a prompt has to exit, not be typed into the answer.
        if (char === CTRL_C) process.exit(130);
        if (char === DEL || char === BACKSPACE) {
          buffer = buffer.slice(0, -1);
          continue;
        }
        buffer += char;
        if (maskTo) maskTo.write('*');
      }
    };

    if (maskTo && input.setRawMode) input.setRawMode(true);
    input.setEncoding('utf8');
    input.resume();
    input.on('data', onData);
  });
}
