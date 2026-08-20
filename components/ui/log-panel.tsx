import { LogViewer, Panel, defineComponent, useStream, type BoxProps } from '@textui/core';
import type { StreamSource } from '@textui/core';

/**
 * A log tail wired to a stream.
 *
 * The component does not care where the lines come from - a child process, a
 * socket, a store path - because everything is adapted to one stream shape
 * before it gets here. Change `parse` to match your log format.
 */
export interface LogPanelProps extends BoxProps {
  source: StreamSource<string> | null;
  title?: string;
  visibleRows?: number;
  /** Lines kept in memory. Older ones are dropped. */
  limit?: number;
  parse?(line: string): { time?: string; level?: 'debug' | 'info' | 'warn' | 'error'; message: string };
}

const DEFAULT_PARSE = (line: string) => {
  // `10:32:04 WARN  billing  retry 3/5`
  const match = /^(\d{2}:\d{2}:\d{2})\s+(DEBUG|INFO|WARN|ERROR)\s+(.*)$/i.exec(line);
  if (!match) return { message: line };
  return {
    time: match[1],
    level: (match[2] as string).toLowerCase() as 'debug' | 'info' | 'warn' | 'error',
    message: match[3] as string,
  };
};

export function LogPanel({
  source, title = 'Logs', visibleRows = 10, limit = 500, parse = DEFAULT_PARSE, ...rest
}: LogPanelProps) {
  const raw = useStream(source, { limit });
  const lines = raw.map(parse);

  return (
    <Panel title={title} meta={`${raw.length}`} {...rest}>
      <LogViewer lines={lines} visibleRows={visibleRows} />
    </Panel>
  );
}

export default defineComponent('LogPanel', LogPanel);
