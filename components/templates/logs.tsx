import { defineComponent, useStoreValue, useState } from '@textui/core';
import { Column, KeyHints, LogViewer, Row, SearchBox, Select } from '@textui/widgets';

/**
 * A full-screen log viewer.
 *
 * Filtering happens here rather than at the source on purpose: the tail keeps
 * arriving while you narrow it, and a filter that discards lines as they land
 * cannot be widened again without re-reading everything.
 */
export interface LogLine {
  time?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  source?: string;
  message: string;
}

const LEVELS = [
  { value: 'all', label: 'all levels' },
  { value: 'info', label: 'info and above' },
  { value: 'warn', label: 'warnings and errors' },
  { value: 'error', label: 'errors only' },
];

const RANK = { debug: 0, info: 1, warn: 2, error: 3 } as const;

export function LogsScreen() {
  const lines = useStoreValue<LogLine[]>('$/logs/lines', []) ?? [];
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');

  const minimum = level === 'all' ? -1 : RANK[level as keyof typeof RANK];
  const filtered = lines.filter((line) => {
    if (minimum >= 0 && RANK[line.level ?? 'debug'] < minimum) return false;
    if (query === '') return true;
    const haystack = `${line.source ?? ''} ${line.message}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={2}>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Filter…"
          count={filtered.length}
          flex={1}
        />
        <Select options={LEVELS} value={level} onChange={setLevel} />
      </Row>

      <LogViewer lines={filtered} visibleRows={20} flex={1} />

      <KeyHints
        hints={[
          { keys: 'up/down', label: 'scroll' },
          { keys: 'end', label: 'follow' },
          { keys: '/', label: 'filter' },
          { keys: 'q', label: 'quit' },
        ]}
      />
    </Column>
  );
}

export default defineComponent('LogsScreen', LogsScreen);
