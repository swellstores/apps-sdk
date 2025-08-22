export interface CFWorkerContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface CFThemeEnv {
  THEME?: CFWorkerKV;
  KV_FLAVOR?: string;
}

// Cloudflare KV

export type CFWorkerKVGetType = 'text' | 'json' | 'arrayBuffer' | 'stream';

export interface CFWorkerKVGetOptions<T extends CFWorkerKVGetType> {
  cacheTtl?: number;
  type?: T;
}

export interface CFWorkerKVGetMetadataResponse<T> {
  value: T | null;
  metadata: string | Record<string, unknown> | null;
}

export interface CFWorkerKVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: object;
}

export interface CFWorkerKVListOptions {
  prefix?: string;
  limit?: string;
  cursor?: string;
}

export interface CFWorkerKVKeyInfo {
  name: string;
  expiration?: number;
  metadata?: object;
}

export interface CFWorkerKVListResponse {
  keys: CFWorkerKVKeyInfo[];
  list_complete: boolean;
  cursor: string;
}

export interface CFWorkerKV {
  get(
    key: string,
    type?: 'text',
    options?: CFWorkerKVGetOptions<'text'>,
  ): Promise<string | null>;
  get(
    key: string,
    type?: 'arrayBuffer',
    options?: CFWorkerKVGetOptions<'arrayBuffer'>,
  ): Promise<ArrayBuffer | null>;
  get(
    key: string,
    type?: 'stream',
    options?: CFWorkerKVGetOptions<'stream'>,
  ): Promise<ReadableStream<Uint8Array> | null>;
  get<T>(
    key: string,
    type?: 'json',
    options?: CFWorkerKVGetOptions<'json'>,
  ): Promise<T | null>;

  // Bulk read: up to 100 keys per call
  get(
    keys: string[],
    type?: 'text',
    options?: CFWorkerKVGetOptions<'text'>,
  ): Promise<Map<string, string | null>>;
  get(
    keys: string[],
    type?: 'json',
    options?: CFWorkerKVGetOptions<'json'>,
  ): Promise<Map<string, object | null>>;

  getWithMetadata(
    key: string,
    type?: 'text',
    options?: CFWorkerKVGetOptions<'text'>,
  ): Promise<CFWorkerKVGetMetadataResponse<string>>;
  getWithMetadata(
    key: string,
    type?: 'arrayBuffer',
    options?: CFWorkerKVGetOptions<'arrayBuffer'>,
  ): Promise<CFWorkerKVGetMetadataResponse<ArrayBuffer>>;
  getWithMetadata(
    key: string,
    type?: 'stream',
    options?: CFWorkerKVGetOptions<'stream'>,
  ): Promise<CFWorkerKVGetMetadataResponse<ReadableStream<Uint8Array>>>;
  getWithMetadata<T>(
    key: string,
    type?: 'json',
    options?: CFWorkerKVGetOptions<'json'>,
  ): Promise<CFWorkerKVGetMetadataResponse<T>>;

  // Bulk read with metadata: up to 100 keys per call
  getWithMetadata(
    keys: string[],
    type?: 'text',
    options?: CFWorkerKVGetOptions<'text'>,
  ): Promise<
    Map<
      string,
      {
        value: string | null;
        metadata: string | Record<string, unknown> | null;
      }
    >
  >;
  getWithMetadata(
    keys: string[],
    type?: 'json',
    options?: CFWorkerKVGetOptions<'json'>,
  ): Promise<
    Map<
      string,
      {
        value: object | null;
        metadata: string | Record<string, unknown> | null;
      }
    >
  >;

  put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: CFWorkerKVPutOptions,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: CFWorkerKVListOptions): Promise<CFWorkerKVListResponse>;
}

// Cloudflare Cache API

export type CFCache = Cache;
