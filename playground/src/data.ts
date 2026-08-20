import type { TextUIApp } from '@textui/core';

/**
 * Fixtures.
 *
 * The playgrounds all read from the store rather than holding props, because
 * that is how a real application is wired and a playground that cheats teaches
 * the wrong thing. Everything here is a data provider or a seeded path.
 */

export interface Service {
  id: string;
  name: string;
  status: 'up' | 'degraded' | 'down';
  cpu: number;
  memory: string;
  uptime: string;
  requestsPerSecond: number;
}

export const SERVICES: Service[] = [
  { id: 'api', name: 'api-gateway', status: 'up', cpu: 12.4, memory: '310 MB', uptime: '6d 04h', requestsPerSecond: 1284 },
  { id: 'auth', name: 'auth-service', status: 'up', cpu: 3.1, memory: '96 MB', uptime: '6d 04h', requestsPerSecond: 212 },
  { id: 'billing', name: 'billing-worker', status: 'degraded', cpu: 48.9, memory: '1.2 GB', uptime: '0d 02h', requestsPerSecond: 17 },
  { id: 'search', name: 'search-indexer', status: 'up', cpu: 21.7, memory: '744 MB', uptime: '2d 11h', requestsPerSecond: 903 },
  { id: 'mailer', name: 'mailer', status: 'down', cpu: 0, memory: '0 MB', uptime: '-', requestsPerSecond: 0 },
  { id: 'cache', name: 'redis-cache', status: 'up', cpu: 6.2, memory: '2.0 GB', uptime: '14d 22h', requestsPerSecond: 8410 },
];

export interface LogLine {
  time: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

export const LOGS: LogLine[] = [
  { time: '14:32:01', level: 'info', source: 'api-gateway', message: '200 GET /v1/orders 14ms' },
  { time: '14:32:02', level: 'debug', source: 'auth-service', message: 'token cache hit' },
  { time: '14:32:04', level: 'warn', source: 'billing-worker', message: 'retry 3/5, timeout after 30s' },
  { time: '14:32:05', level: 'info', source: 'api-gateway', message: '200 POST /v1/orders 31ms' },
  { time: '14:32:07', level: 'error', source: 'mailer', message: 'connect ECONNREFUSED 10.0.2.19:587' },
  { time: '14:32:09', level: 'info', source: 'search-indexer', message: 'indexed 1204 documents' },
  { time: '14:32:11', level: 'warn', source: 'billing-worker', message: 'retry 4/5, timeout after 30s' },
  { time: '14:32:14', level: 'error', source: 'billing-worker', message: 'giving up after 5 attempts' },
  { time: '14:32:15', level: 'info', source: 'redis-cache', message: 'evicted 220 keys' },
  { time: '14:32:18', level: 'info', source: 'api-gateway', message: '304 GET /v1/health 2ms' },
];

export const EVENTS = [
  { time: '14:30', title: 'Liveness probe failed', description: 'billing-worker, 3 consecutive', tone: 'warning' as const },
  { time: '14:31', title: 'Container restarted', description: 'billing-worker on ip-10-0-2-19', tone: 'info' as const },
  { time: '14:32', title: 'Delivery failing', description: 'mailer cannot reach the relay', tone: 'danger' as const },
  { time: '14:35', title: 'Index rebuilt', description: 'search-indexer, 1204 documents', tone: 'success' as const },
];

/** A deterministic wave, so a playground looks alive without being random. */
export function wave(length: number, seed = 1, amplitude = 40, offset = 45): number[] {
  return Array.from({ length }, (_, i) =>
    Math.round(
      offset +
        Math.sin((i + seed) / 3) * amplitude * 0.5 +
        Math.sin((i + seed) / 7) * amplitude * 0.3 +
        Math.sin((i + seed) / 11) * amplitude * 0.2,
    ),
  );
}

/** The same fixtures as a plain object, for the static renderer. */
export function fixtures(): Record<string, unknown> {
  return {
    '$/services/list': SERVICES,
    '$/logs/lines': LOGS,
    '$/events/list': EVENTS,
    '$/metrics/cpu/history': wave(40, 1, 60, 40),
    '$/metrics/memory/history': wave(40, 5, 30, 60),
    '$/metrics/latency/history': wave(40, 9, 200, 180),
    '$/metrics/network/history': wave(40, 3, 90, 110),
    '$/metrics/errors/grid': [
      wave(12, 1, 8, 4), wave(12, 4, 8, 3), wave(12, 7, 8, 6),
      wave(12, 10, 8, 2), wave(12, 13, 8, 5),
    ],
  };
}

export function seedStore(app: TextUIApp): void {
  app.store.batch(() => {
    app.store.set('$/services/list', SERVICES);
    app.store.set('$/logs/lines', LOGS);
    app.store.set('$/events/list', EVENTS);
    app.store.set('$/metrics/cpu/history', wave(40, 1, 60, 40));
    app.store.set('$/metrics/memory/history', wave(40, 5, 30, 60));
    app.store.set('$/metrics/latency/history', wave(40, 9, 200, 180));
    app.store.set('$/metrics/network/history', wave(40, 3, 90, 110));
    app.store.set('$/metrics/errors/grid', [
      wave(12, 1, 8, 4), wave(12, 4, 8, 3), wave(12, 7, 8, 6),
      wave(12, 10, 8, 2), wave(12, 13, 8, 5),
    ]);
  });

  // A derived count, to show the store's computed paths doing real work.
  app.store.computed('$/summary/services/degraded', {
    from: ['$/services/list'],
    select: (values) => {
      const list = (values['$/services/list'] as Service[] | undefined) ?? [];
      return list.filter((s) => s.status !== 'up').length;
    },
  });
}
