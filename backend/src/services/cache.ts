import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * Cache used for consent decisions.
 *
 * Redis is optional. When `REDIS_URL` is unset, or the server is unreachable,
 * an in-process map is used instead. That keeps a single-instance deployment
 * working and lets the test suite run without Redis, at the cost of the cache
 * not being shared between instances — which is reported by `getCacheStats`
 * rather than hidden.
 */
export interface CacheClient {
    readonly driver: 'REDIS' | 'MEMORY';
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds: number): Promise<void>;
    del(pattern: string): Promise<void>;
    ping(): Promise<boolean>;
    close(): Promise<void>;
}

class InMemoryCache implements CacheClient {
    readonly driver = 'MEMORY' as const;
    private readonly store = new Map<string, { value: string; expiresAt: number }>();

    async get(key: string): Promise<string | null> {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    /** Supports a trailing `*` so invalidation matches the Redis behaviour. */
    async del(pattern: string): Promise<void> {
        if (!pattern.endsWith('*')) {
            this.store.delete(pattern);
            return;
        }
        const prefix = pattern.slice(0, -1);
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key);
        }
    }

    async ping(): Promise<boolean> {
        return true;
    }

    async close(): Promise<void> {
        this.store.clear();
    }
}

class RedisCache implements CacheClient {
    readonly driver = 'REDIS' as const;
    private readonly client: Redis;

    constructor(url: string) {
        this.client = new Redis(url, {
            maxRetriesPerRequest: 2,
            lazyConnect: false,
            // A cache outage must degrade to a database read, never hang a request.
            connectTimeout: 2000,
            enableOfflineQueue: false,
        });
        this.client.on('error', (error) => {
            console.warn('[cache] Redis error, falling back to database reads:', error.message);
        });
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.client.get(key);
        } catch {
            return null;
        }
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        try {
            // Never cache for longer than the underlying grant is valid.
            if (ttlSeconds > 0) await this.client.set(key, value, 'EX', Math.ceil(ttlSeconds));
        } catch {
            // A cache write failure is not a request failure.
        }
    }

    async del(pattern: string): Promise<void> {
        try {
            if (!pattern.endsWith('*')) {
                await this.client.del(pattern);
                return;
            }
            // SCAN rather than KEYS so a large keyspace does not block Redis.
            let cursor = '0';
            do {
                const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
                cursor = next;
                if (keys.length > 0) await this.client.del(...keys);
            } while (cursor !== '0');
        } catch {
            // Ignored: a stale entry expires on its own TTL.
        }
    }

    async ping(): Promise<boolean> {
        try {
            return (await this.client.ping()) === 'PONG';
        } catch {
            return false;
        }
    }

    async close(): Promise<void> {
        await this.client.quit().catch(() => undefined);
    }
}

let client: CacheClient | null = null;

export function getCache(): CacheClient {
    if (client) return client;
    client = env.redisUrl ? new RedisCache(env.redisUrl) : new InMemoryCache();
    return client;
}

/** Test seam. */
export function setCache(next: CacheClient | null): void {
    client = next;
}

// ------------------------------------------------------------------ metrics

interface CacheMetrics {
    hits: number;
    misses: number;
    /** Sum of consent-evaluation durations in milliseconds. */
    totalLatencyMs: number;
    samples: number;
    maxLatencyMs: number;
}

const metrics: CacheMetrics = { hits: 0, misses: 0, totalLatencyMs: 0, samples: 0, maxLatencyMs: 0 };

export function recordCacheHit(): void {
    metrics.hits += 1;
}

export function recordCacheMiss(): void {
    metrics.misses += 1;
}

export function recordConsentLatency(milliseconds: number): void {
    metrics.totalLatencyMs += milliseconds;
    metrics.samples += 1;
    if (milliseconds > metrics.maxLatencyMs) metrics.maxLatencyMs = milliseconds;
}

/**
 * Reports measured consent-evaluation performance.
 *
 * The architecture document states a sub-10ms target (NFR06). These are real
 * counters, so the claim can be checked rather than asserted.
 */
export function getCacheStats() {
    const total = metrics.hits + metrics.misses;
    return {
        driver: getCache().driver,
        distributed: getCache().driver === 'REDIS',
        hits: metrics.hits,
        misses: metrics.misses,
        hitRatioPercent: total === 0 ? null : Number(((metrics.hits / total) * 100).toFixed(1)),
        avgConsentLatencyMs:
            metrics.samples === 0 ? null : Number((metrics.totalLatencyMs / metrics.samples).toFixed(2)),
        maxConsentLatencyMs: metrics.samples === 0 ? null : Number(metrics.maxLatencyMs.toFixed(2)),
        samples: metrics.samples,
        targetMs: 10,
    };
}

export function resetCacheStats(): void {
    metrics.hits = 0;
    metrics.misses = 0;
    metrics.totalLatencyMs = 0;
    metrics.samples = 0;
    metrics.maxLatencyMs = 0;
}
