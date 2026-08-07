/**
 * Soft TTL for list refetches so route remounts reuse Redux data briefly.
 * Force refresh buttons should call with force=true or mark stale first.
 */

const lastOkAt = new Map<string, number>();

const DEFAULT_TTL_MS = 30_000;

export function shouldRefetchAdminList(
    key: string,
    options?: { ttlMs?: number; force?: boolean; hasRows?: boolean }
): boolean {
    if (options?.force) return true;
    if (options?.hasRows === false) return true;
    const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
    const at = lastOkAt.get(key);
    if (at == null) return true;
    return Date.now() - at > ttl;
}

export function markAdminListFetched(key: string): void {
    lastOkAt.set(key, Date.now());
}

export function invalidateAdminList(key: string): void {
    lastOkAt.delete(key);
}
