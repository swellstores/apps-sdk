import { SwellBackendAPI, SwellError, getStorefrontConfig, requireStoreUser, verifySwellContext } from '@swell/apps-sdk';
import { createStorefrontClient } from '@swell/apps-sdk/storefront';
export default {
  async fetch(request, env) {
    if (env.PROCESS_ENV_TEST !== 'true' && (typeof process !== 'undefined' || typeof Buffer !== 'undefined')) throw new Error('Node compatibility unexpectedly enabled');
    const id = new URL(request.url).searchParams.get('id');
    const headers = new Headers({ 'Swell-Store-Id': id, 'Swell-Access-Token': `token-${id}`, 'Swell-API-Host': 'https://backend.test', 'Swell-Public-Key': `pk-${id}`, 'Swell-Admin-Url': `https://${id}.test` });
    headers.set('Swell-Context', request.headers.get('Swell-Context'));
    let context;
    let storeUser;
    try {
      context = await verifySwellContext(headers, { env: env.PROCESS_ENV_TEST === 'true' ? undefined : env, appId: 'app', storeId: id });
      storeUser = requireStoreUser(context);
    } catch (error) {
      if (!(error instanceof SwellError)) throw error;
      return Response.json({ code: error.code }, { status: error.status });
    }
    if (new URL(request.url).pathname === '/context') return Response.json({ storeUser, signatureVerified: context.signatureVerified });
    const writes = [];
    const values = new Map();
    const client = createStorefrontClient(getStorefrontConfig(context), { cookies: { get: name => values.get(name) ?? `${id}:${name}`, set: (...args) => { values.set(args[0], args[1]); writes.push(args); } } });
    const api = new SwellBackendAPI({ context });
    const [storefront, backend] = await Promise.all([
      client.products.list(), api.get('/products', { null: null }),
    ]);
    let readOnly = false;
    try { await createStorefrontClient(getStorefrontConfig(context), { cookies: { get() {} } }).get('/products'); }
    catch (error) { readOnly = error.message.includes('read-only'); }
    let redirect = false;
    try { await api.get('/redirect'); } catch (error) { redirect = error instanceof SwellError && error.status === 302; }
    return Response.json({ id, storefront, backend, storeUser, writes, session: client.getCookie('swell-session'), readOnly, redirect });
  },
};
