import { SwellBackendAPI, SwellError, getStorefrontConfig, requireStoreUser, verifySwellContext } from '@swell/apps-sdk';
import type { SwellCollection, SwellRequestContext, StoreUser, SwellHeadersEnv, SwellData, TransactionOperation, TransactionOptions } from '@swell/apps-sdk';
import { createStorefrontClient } from '@swell/apps-sdk/storefront';
import type { CookieOptions } from '@swell/apps-sdk/storefront';
import type { PublicConfig, SwellClient } from 'swell-js';
const headers = new Headers();
const config: PublicConfig = { storeId: 's', publicKey: 'pk' };
const backend = new SwellBackendAPI({ storeId: 's', secretKey: 'k', apiHost: 'https://api.test' });
const explicit = new SwellBackendAPI({ storeId: 's', accessToken: 't', apiHost: 'https://api.test' });
// @ts-expect-error raw header parsing is not part of the public API
import { parseSwellHeaders } from '@swell/apps-sdk';
// @ts-expect-error the unverified context type is not part of the public API
import type { SwellContext } from '@swell/apps-sdk';
// @ts-expect-error public config requires a request context
getStorefrontConfig(headers);
// @ts-expect-error backend clients do not accept raw headers
new SwellBackendAPI({ headers });
const result: Promise<{ count: number }> = backend.get<{ count: number }>('/products');
const list: Promise<SwellCollection<{ id: string }>> = backend.get<SwellCollection<{ id: string }>>('/products');
const updated: Promise<{ id: string }> = backend.put<{ id: string }>('/products/1', { name: 'Updated' });
const created: Promise<{ id: string }> = backend.post<{ id: string }>('/products', { name: 'New' });
const deleted: Promise<null> = backend.delete<null>('/products/1');
const settings: Promise<{ enabled: boolean }> = backend.settings<{ enabled: boolean }>('app');
const workflow: Promise<SwellData> = backend.workflows.create('sync', { id: '1' });
const operations: TransactionOperation[] = [{ method: 'put', url: '/products/1', data: { name: 'Updated' } }];
const retryOptions: TransactionOptions = { retry: { limit: 2, base: 100, max: 1000, jitter: false } };
const transaction: Promise<any[]> = backend.transaction(operations, retryOptions);
backend.transaction(operations, { retry: true });
// @ts-expect-error retry delays are milliseconds, not strings
backend.transaction(operations, { retry: { base: '100' } });
const called: Promise<{ ok: boolean }> = backend.functions.call<{ ok: boolean }>('multiseller', 'sync', { id: 1 });
backend.functions.call('multiseller', 'report', { month: 9 }, { method: 'get' });
// @ts-expect-error only the four route methods are supported
backend.functions.call('multiseller', 'report', {}, { method: 'patch' });
const cookies = { get(name: string) { return name; }, set(name: string, value: string, options: CookieOptions) { const age: number | undefined = options.maxAge; } };
const snake: SwellClient<'snake'> = createStorefrontClient(config, { cookies });
const camel: SwellClient<'camel'> = createStorefrontClient({ ...config, useCamelCase: true }, { cookies });
const originalRequest = snake.request;
snake.request = <T,>(...args: Parameters<SwellClient['request']>): Promise<T> => originalRequest<T>(...args);
const wrapped: Promise<{ ok: boolean }> = snake.request<{ ok: boolean }>('get', '/custom', 'id', { limit: 1 }, { force: true });
createStorefrontClient(config, { cookieOptions: {}, cookies: { get() { return undefined; }, set() {} } });
// @ts-expect-error a cookie reader is required even when a writer is supplied
createStorefrontClient(config, { cookies: { set() {} } });
// @ts-expect-error raw headers are not a backend option
new SwellBackendAPI({ headers, ...{ storeId: 's', secretKey: 'k', apiHost: 'https://api.test' } });
// @ts-expect-error exactly one credential is required
new SwellBackendAPI({ storeId: 's', secretKey: 'k', accessToken: 't', apiHost: 'https://api.test' });
async function requestContext(env: SwellHeadersEnv) {
  const resolved: SwellRequestContext = await verifySwellContext(headers, { env, appId: 'app', storeId: 'store' });
  const storeUser: StoreUser = requireStoreUser(resolved);
  const optional: StoreUser | null = resolved.storeUser;
  const publicConfig: PublicConfig = getStorefrontConfig(resolved);
  const client = new SwellBackendAPI({ context: resolved });
  // @ts-expect-error verified context and raw credentials cannot be mixed
  new SwellBackendAPI({ context: resolved, secretKey: 'override' });
  // @ts-expect-error context and headers cannot be mixed
  new SwellBackendAPI({ context: resolved, headers });
  // @ts-expect-error request identity is immutable
  resolved.storeId = 'different';
  // @ts-expect-error raw headers do not provide a store user
  requireStoreUser(headers);
}
new SwellError('no');
// @ts-expect-error Function execution is not part of the public SDK.
import type { SwellRequest } from '@swell/apps-sdk/functions';
import { createComponents, startComponentFrame } from '@swell/apps-sdk/components';
import type { ComponentConfig, ComponentHandle, ComponentProps, ComponentToken } from '@swell/apps-sdk/components';
const components = createComponents({ storeId: 's', publicKey: 'pk', getToken: async (app: string): Promise<ComponentToken> => ({ token: app, expires: 0 }) });
function mountComponent(element: HTMLElement) {
  const handle: ComponentHandle<string> = components.mount<string>(element, { app: 'app', component: 'ColorPicker', value: '#fff', context: { id: '1' } });
  const ready: Promise<void> = handle.ready;
  handle.on('change', (value: string) => value.toUpperCase());
  handle.on('validity', (error: string | null) => error);
  handle.on('error', (error: Error) => error.message);
  handle.update({ value: '#000', readonly: true });
  // @ts-expect-error mount returns the handle, not a promise
  components.mount(element, { app: 'app', component: 'ColorPicker' }).then;
  const result: Promise<{ ok: boolean }> = handle.emit<{ ok: boolean }>('submit', { cart: {} });
  // @ts-expect-error the component name is required
  components.mount(element, { app: 'app' });
  // @ts-expect-error a string component cannot receive a number
  handle.update({ value: 1 });
  return result;
}
function ColorPicker({ value, setValue, fetch }: ComponentProps<string>) {
  setValue(value.trim());
  // @ts-expect-error setValue is typed by the component's value type
  setValue(1);
  return fetch('/functions/app/fn');
}
const componentConfig: ComponentConfig = { description: 'Color' };
startComponentFrame({ bundleUrl: 'https://cdn.test/component.js' });
