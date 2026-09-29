export interface SwellErrorOptions {
  status?: number;
  method?: string;
  endpointUrl?: string;
  code?: string;
  retry?: boolean;
}

/**
 * Backend or function error; ordinary operations never retry automatically.
 * Machine-readable contract: `status`, optional `code` and optional `body`.
 * Ordinary backend errors retain structured responses in `body`; string errors have no body.
 * HTTP-200 non-GET validation failures retain the `errors` field map. Function invocation
 * failures retain the response payload or, if nullish, the invocation envelope.
 * `message` is for humans and may change.
 */
export class SwellError extends Error {
  status: number;
  body?: any;
  code?: string;
  retry?: boolean;

  constructor(message: any, options: SwellErrorOptions = {}) {
    const body = typeof message === 'string' ? undefined : message;
    let formatted = typeof message === 'string' ? message
      : typeof body?.error?.message === 'string' ? body.error.message : JSON.stringify(message, null, 2);
    if (options.method && options.endpointUrl) formatted = `${options.method} /${options.endpointUrl}\n${formatted}`;
    super(formatted);
    this.name = 'SwellError';
    this.status = options.status || 500;
    this.body = body;
    this.code = options.code || body?.error?.code;
    this.retry = options.retry;
  }

  get isRetryable(): boolean {
    return this.code === 'transaction_conflict' || this.code === 'transaction_throttled';
  }
}
