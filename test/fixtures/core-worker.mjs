import { SwellBackendAPI, SwellError, getStorefrontConfig, requireStaff } from '@swell/apps-sdk';
import { createStorefrontClient } from '@swell/apps-sdk/storefront';
export default {
  async fetch(request) {
    if (typeof process !== 'undefined' || typeof Buffer !== 'undefined') throw new Error('Node compatibility unexpectedly enabled');
    const id = new URL(request.url).searchParams.get('id');
    const headers = new Headers({ 'Swell-Store-Id': id, 'Swell-Access-Token': `token-${id}`, 'Swell-API-Host': 'https://backend.test', 'Swell-Public-Key': `pk-${id}`, 'Swell-Admin-Url': `https://${id}.test` });
    const writes = [];
    const values = new Map();
    const client = createStorefrontClient(getStorefrontConfig(headers), { cookies: { get: name => values.get(name) ?? `${id}:${name}`, set: (...args) => { values.set(args[0], args[1]); writes.push(args); } } });
    const api = new SwellBackendAPI({ headers });
    const [storefront, backend, staff] = await Promise.all([
      client.products.list(), api.get('/products', { null: null }),
      requireStaff({ headers, method: 'GET', origin: 'https://app.test', cookies: { get: () => id } }),
    ]);
    let readOnly = false;
    try { await createStorefrontClient(getStorefrontConfig(headers), { cookies: { get() {} } }).get('/products'); }
    catch (error) { readOnly = error.message.includes('read-only'); }
    let redirect = false;
    try { await api.get('/redirect'); } catch (error) { redirect = error instanceof SwellError && error.status === 302; }
    return Response.json({ id, storefront, backend, staff, writes, session: client.getCookie('swell-session'), readOnly, redirect });
  },
};
