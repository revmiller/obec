/// In-memory TTL cache for CCIP-Read gateway responses.
/// Within a warm Vercel function instance, this prevents redundant Base Sepolia RPC calls
/// when multiple judges resolve the same ENS name within the cache window.
/// Cold starts reset the cache; production deployments can swap in @vercel/kv if cross-instance
/// caching is needed.

type Entry = { value: string; expiresAt: number };

const TTL_MS = 60_000;
const MAX_ENTRIES = 1024;

const cache = new Map<string, Entry>();

export function cacheGet(key: string): string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key: string, value: string): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  if (cache.size > MAX_ENTRIES) _evictExpired();
}

function _evictExpired(): void {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt < now) cache.delete(k);
  }
}
