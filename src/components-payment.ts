// Payment intents of payment components, through the vault exactly as swell-js sends them
const TIMEOUT_MS = 20_000;

export interface PaymentActionsOptions {
  vaultUrl: string;
  publicKey: string;
  gateway: string;
  /** The current cart's account, read at call time */
  accountId: () => string | undefined;
}

function serialize(key: string, value: unknown, out: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => serialize(`${key}[${item !== null && typeof item === 'object' ? index : ''}]`, item, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) serialize(`${key}[${name}]`, item, out);
  } else if (value !== undefined) {
    out.push(`${encodeURIComponent(key)}=${encodeURIComponent(value === null ? '' : String(value))}`);
  }
}

async function vaultRequest(options: PaymentActionsOptions, method: 'get' | 'post', intent: unknown): Promise<unknown> {
  const accountId = options.accountId();
  const data = { gateway: options.gateway, ...(accountId ? { account_id: accountId } : {}), intent };
  const query: string[] = [];
  serialize('$jsonp', { method, callback: 'none' }, query);
  serialize('$data', data, query);
  serialize('$key', options.publicKey, query);
  const response = await fetch(`${options.vaultUrl.replace(/\/+$/, '')}/intent?${query.join('&')}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const result = (await response.json()) as { $error?: string; $status?: number; $data?: { errors?: Record<string, { message?: string }> } };
  if (result?.$error) throw new Error(result.$error);
  if (!result || (result.$status ?? 500) >= 300) throw new Error('A connection error occurred while making the request');
  const errors = result.$data?.errors;
  if (errors) throw new Error(Object.values(errors)[0]?.message || 'Unknown error');
  return result.$data;
}

export function paymentActions(options: PaymentActionsOptions) {
  return {
    createIntent: (data: unknown) => vaultRequest(options, 'post', data),
    getIntent: (data: unknown) => vaultRequest(options, 'get', data),
  };
}
