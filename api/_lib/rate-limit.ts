import { createHmac } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

import { HttpError } from './http-errors.js';

interface Counter {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<Counter>;
}

const localCounters = new Map<string, Counter>();

export const localOnlyRateLimitStore: RateLimitStore = {
  async increment(key, windowMs) {
    const now = Date.now();
    const existing = localCounters.get(key);
    const next = !existing || existing.resetAt <= now
      ? { count: 1, resetAt: now + windowMs }
      : { count: existing.count + 1, resetAt: existing.resetAt };
    localCounters.set(key, next);
    return next;
  },
};

export class UpstashRedisRateLimitStore implements RateLimitStore {
  constructor(private readonly url: string, private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async increment(key: string, windowMs: number): Promise<Counter> {
    const safeKey = `metodo-pame:rl:${createHmac('sha256', this.token).update(key).digest('hex')}`;
    const script = "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return {count,redis.call('PTTL',KEYS[1])}";
    const response = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['EVAL', script, '1', safeKey, String(windowMs)]]),
    });
    if (!response.ok) throw new HttpError(503, 'RATE_LIMIT_STORE_UNAVAILABLE', 'Rate limit storage is unavailable');
    const payload = await response.json() as Array<{ result?: [number, number]; error?: string }>;
    const result = payload[0]?.result;
    if (!result || payload[0]?.error || !Number.isFinite(result[0]) || !Number.isFinite(result[1])) {
      throw new HttpError(503, 'RATE_LIMIT_STORE_UNAVAILABLE', 'Rate limit storage is unavailable');
    }
    return { count: result[0], resetAt: Date.now() + Math.max(0, result[1]) };
  }
}

export function configuredRateLimitStore(env: Record<string, string | undefined> = process.env): RateLimitStore | undefined {
  if (env.RATE_LIMIT_PROVIDER !== 'upstash_redis') return undefined;
  // The official Vercel ↔ Upstash integration owns these values and prefixes
  // them as `UPSTASH_REDIS_KV_*`. Keep the explicit names first so a
  // non-Vercel runtime can configure the same provider without coupling to the
  // integration's naming convention.
  const url = env.UPSTASH_REDIS_REST_URL ?? env.UPSTASH_REDIS_KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.UPSTASH_REDIS_KV_REST_API_TOKEN;
  if (!url || !token) return undefined;
  return new UpstashRedisRateLimitStore(url, token);
}

function requestAddress(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || 'unknown';
}

export async function enforcePublicRateLimit(
  req: VercelRequest,
  namespace: string,
  options: {
    limit: number;
    windowMs: number;
    store?: RateLimitStore;
    production?: boolean;
  },
): Promise<void> {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const store = options.store ?? (production ? configuredRateLimitStore() : localOnlyRateLimitStore);

  if (!store) {
    throw new HttpError(
      503,
      'RATE_LIMIT_STORAGE_REQUIRED',
      'A durable rate-limit store is required before production deployment',
    );
  }

  const result = await store.increment(
    `${namespace}:${requestAddress(req)}`,
    options.windowMs,
  );
  if (result.count > options.limit) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many requests');
  }
}
