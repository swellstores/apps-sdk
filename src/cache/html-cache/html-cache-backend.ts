/**
 * Represents a standardized, serializable cache entry.
 * This object is used to pass data between the core caching logic and the
 * storage backend, ensuring that any backend can store and retrieve the
 * necessary information consistently.
 */
export interface CachedEntry {
  /** The HTTP status code of the original response (e.g., 200). */
  status: number;

  /** The HTTP status text of the original response (e.g., "OK"). */
  statusText: string;

  /**
   * A record of the original response headers.
   * Stored as a plain object for easy JSON serialization.
   */
  headers: Record<string, string>;

  /** The response body, stored as a UTF-8 string. */
  body: string;

  /** The ISO 8601 timestamp string indicating when the entry was created. */
  cacheTimeISO: string;

  /** The Time-to-Live (TTL) for this entry in seconds. */
  ttl: number;

  /** The Stale-While-Revalidate (SWR) period for this entry in seconds. */
  swr: number;

  /**
   * The ETag from the original response, if present.
   * Used for handling 'If-None-Match' conditional requests.
   */
  etag?: string;

  /**
   * The Last-Modified date from the original response, if present.
   * Used for handling 'If-Modified-Since' conditional requests.
   * Should be stored as a UTC string.
   */
  lastModifiedUTC?: string;
}

/**
 * Defines the contract for a storage backend.
 * Any class implementing this interface can be used as a storage layer
 * for the HtmlCache, allowing for a pluggable architecture.
 */
export interface CacheBackend {
  /**
   * Reads a cached entry from the storage.
   * @param key The unique identifier for the cache entry.
   * @returns A promise that resolves to the `CachedEntry` if found, or `null` otherwise.
   */
  read(key: string): Promise<CachedEntry | null>;

  /**
   * Writes a cache entry to the storage.
   * @param key The unique identifier for the cache entry.
   * @param entry The `CachedEntry` object to store.
   * @param hardExpireSeconds The total lifetime of the entry in the storage system
   * @returns A promise that resolves when the write operation is complete.
   */
  write(
    key: string,
    entry: CachedEntry,
    hardExpireSeconds: number,
  ): Promise<void>;

  /**
   * Deletes a cache entry from the storage.
   * This is optional but recommended for cache invalidation.
   * @param key The unique identifier for the cache entry to delete.
   * @returns A promise that resolves when the delete operation is complete.
   */
  delete?(key: string): Promise<void>;
}
