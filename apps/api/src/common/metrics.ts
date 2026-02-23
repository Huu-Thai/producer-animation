import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000],
  registers: [register],
});

export const episodeStatusTransitions = new Counter({
  name: 'episode_status_transitions_total',
  help: 'Total episode status transitions',
  labelNames: ['from', 'to'],
  registers: [register],
});

export const voiceCacheHits = new Counter({
  name: 'voice_cache_hits_total',
  help: 'Voice cache hit/miss counters',
  labelNames: ['result'],
  registers: [register],
});
