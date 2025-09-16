import { HtmlCache } from './html-cache';

// --- Mocks for md5 + logger ---
jest.mock('../../utils', () => ({
  md5: (s: string) => {
    // djb2-ish tiny hash, deterministic and short
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return `md5(${(h >>> 0).toString(16)})`;
  },
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn() },
  createTraceId: () => 't',
}));

// In Node <18, uncomment a fetch polyfill:
// import 'cross-fetch/polyfill';

/**
 * In-memory backend (structural type, no imported TS types).
 * Returns a duck-typed CacheBackend without importing the interface.
 */
const makeMemoryBackend = () => {
  /** @type {Map<string, any>} */
  const store = new Map();

  return {
    /** @param {string} key */
    read(key) {
      return Promise.resolve(store.get(key) ?? null);
    },
    /** @param {string} key @param {any} entry @param {number} _hardExpireSeconds */
    write(key, entry, _hardExpireSeconds) {
      store.set(key, entry);
      return Promise.resolve();
    },
    /** @param {string} key */
    delete(key) {
      store.delete(key);
      return Promise.resolve();
    },
    // expose store for debug if needed:
    __store: store,
  };
};

// Helpers
const htmlResponse = (body = '<html>ok</html>') =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

const jsonResponse = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('HtmlCache (backend agnostic)', () => {
  const EPOCH = 'e1';
  let backend;
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    backend = makeMemoryBackend();
    cache = new HtmlCache(EPOCH, backend);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('MISS on empty backend → {found:false, cacheable:true}', async () => {
    const req = new Request('https://site.test/');
    const res = await cache.get(req);
    expect(res).toEqual(
      expect.objectContaining({ found: false, cacheable: true }),
    );
  });

  test('PUT then GET → HIT with correct client caching headers', async () => {
    const req = new Request('https://site.test/pages/a');
    await cache.put(req, htmlResponse());

    const hit = await cache.get(req);
    expect(hit?.found).toBe(true);
    expect(hit?.stale).toBe(false);

    const h = hit.response.headers;
    expect(h.get('Cache-Control')).toBe(
      'public, max-age=1, must-revalidate',
    );
    expect(h.get('Cloudflare-CDN-Cache-Control')).toBe(
      'public, s-maxage=20, stale-while-revalidate=604800, stale-if-error=60',
    );
    expect(h.get('X-Cache-Status')).toBe('HIT');
    expect(Number(h.get('X-Cache-Age'))).toBeGreaterThanOrEqual(0);
  });

  test('Age ≥ TTL but < TTL+SWR → STALE still served', async () => {
    const req = new Request('https://site.test/pages/stale');
    await cache.put(req, htmlResponse());

    jest.setSystemTime(new Date('2025-01-01T00:00:21Z')); // TTL=20s

    const result = await cache.get(req);
    expect(result?.found).toBe(true);
    expect(result?.stale).toBe(true);
    expect(result?.response.headers.get('X-Cache-Status')).toBe('STALE');
  });

  test('Age ≥ TTL+SWR → treated as expired (MISS)', async () => {
    const req = new Request('https://site.test/pages/expired');
    await cache.put(req, htmlResponse());

    // TTL=20s, SWR=604800s (1 week), so expire after 604820s
    jest.setSystemTime(new Date('2025-01-08T00:00:21Z')); // 7 days + 21 seconds later

    const result = await cache.get(req);
    expect(result?.found).toBe(false);
    expect(result?.cacheable).toBe(true);
  });

  test('getWithConditionals returns 304 when If-None-Match matches stored ETag', async () => {
    const req = new Request('https://site.test/pages/cond');
    await cache.put(req, htmlResponse('<html>etagme</html>'));

    const first = await cache.get(req);
    const etag = first.response.headers.get('ETag');
    expect(etag).toBeTruthy();

    const condReq = new Request(req.url, {
      headers: { 'If-None-Match': etag },
    });
    const result = await cache.getWithConditionals(condReq);

    expect(result?.found).toBe(true);
    expect(result?.notModified).toBe(true);
    expect(result?.conditional304?.status).toBe(304);
    expect(result?.conditional304?.headers.get('X-Cache-Status')).toBe(
      'HIT-304',
    );
  });

  test('put skips non-HTML responses (no write)', async () => {
    const req = new Request('https://site.test/pages/json');

    const spyWrite = jest.spyOn(backend, 'write');

    await cache.put(req, jsonResponse()); // should skip writing

    // A get will still attempt a read, but nothing should be in the cache.
    const miss = await cache.get(req);

    expect(spyWrite).not.toHaveBeenCalled(); // ✅ key assertion
    expect(miss?.found).toBe(false);
  });

  test('Query normalization ignores UTM params (same key → HIT)', async () => {
    const putReq = new Request('https://site.test/pages/u?q=1&utm_source=ads');
    await cache.put(putReq, htmlResponse('norm'));

    const getReq = new Request('https://site.test/pages/u?q=1'); // no UTM
    const hit = await cache.get(getReq);

    expect(hit?.found).toBe(true);
    expect(await hit.response.text()).toContain('norm');
  });

  test('editor mode → not cacheable on get/put', async () => {
    const req = new Request('https://site.test/pages/e', {
      headers: { 'swell-deployment-mode': 'editor' },
    });

    const writeSpy = jest.spyOn(backend, 'write');
    await cache.put(req, htmlResponse());
    const res = await cache.get(req);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(res).toEqual(
      expect.objectContaining({ found: false, cacheable: false }),
    );
  });

  test('request with Cache-Control:no-cache → non-cacheable get/put', async () => {
    const req = new Request('https://site.test/pages/cc', {
      headers: { 'cache-control': 'no-cache' },
    });
    const writeSpy = jest.spyOn(backend, 'write');
    await cache.put(req, htmlResponse());
    const res = await cache.get(req);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(res).toEqual(
      expect.objectContaining({ found: false, cacheable: false }),
    );
  });

  test('put skips responses with Set-Cookie/private/no-store', async () => {
    const baseHeaders = { 'content-type': 'text/html; charset=utf-8' };

    const withCookie = new Response('<h1>a</h1>', {
      headers: { ...baseHeaders, 'set-cookie': 'x=1' },
    });
    const privateCtl = new Response('<h1>b</h1>', {
      headers: { ...baseHeaders, 'cache-control': 'private' },
    });
    const noStore = new Response('<h1>c</h1>', {
      headers: { ...baseHeaders, 'cache-control': 'no-store' },
    });

    const req = (p: string) => new Request(`https://site.test/pages/${p}`);

    const spy = jest.spyOn(backend, 'write');

    await cache.put(req('cookie'), withCookie);
    await cache.put(req('private'), privateCtl);
    await cache.put(req('nostore'), noStore);

    expect(spy).not.toHaveBeenCalled();
  });

  test('getWithConditionals (If-Modified-Since) returns 304 when not modified', async () => {
    const req = new Request('https://site.test/pages/ims');
    await cache.put(req, htmlResponse('<p>x</p>'));

    const first = await cache.get(req);
    const lastModified = first!.response!.headers.get('Last-Modified')!;
    const imsReq = new Request(req.url, {
      headers: { 'If-Modified-Since': lastModified },
    });

    const result = await cache.getWithConditionals(imsReq);
    expect(result?.notModified).toBe(true);
    expect(result?.conditional304?.status).toBe(304);
  });

  test('invalid If-Modified-Since does not 304', async () => {
    const req = new Request('https://site.test/pages/ims-bad');
    await cache.put(req, htmlResponse());
    const bad = new Request(req.url, {
      headers: { 'If-Modified-Since': 'nonsense' },
    });
    const result = await cache.getWithConditionals(bad);
    expect(result?.notModified).toBeFalsy();
  });

  test('If-None-Match matches weak/strong ETags per spec', async () => {
    const req = new Request('https://site.test/pages/etag-weak');
    await cache.put(req, htmlResponse('<html>same</html>'));

    const hit = await cache.get(req);
    const etag = hit!.response!.headers.get('ETag')!; // e.g., "...."
    const weakHeader = `W/${etag}`;

    const weakReq = new Request(req.url, {
      headers: { 'If-None-Match': weakHeader },
    });
    const r1 = await cache.getWithConditionals(weakReq);
    expect(r1?.notModified).toBe(true);

    const listReq = new Request(req.url, {
      headers: { 'If-None-Match': '"foo", ' + etag + ', "bar"' },
    });
    const r2 = await cache.getWithConditionals(listReq);
    expect(r2?.notModified).toBe(true);
  });

  test('locale from swell-data cookie varies the cache key, not Accept-Language', async () => {
    const url = 'https://site.test/pages/i18n';

    // Different Accept-Language headers but same locale in cookie should hit same cache
    const enReq1 = new Request(url, {
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    });
    const enReq2 = new Request(url, {
      headers: { 'accept-language': 'en-GB,en;q=0.8' },
    });

    await cache.put(enReq1, htmlResponse('en'));
    const hitEn = await cache.get(enReq2);
    expect(hitEn?.found).toBe(true); // same cache key despite different Accept-Language
    expect(await hitEn!.response!.text()).toBe('en');

    // Different locale in swell-data cookie should use different cache key
    const frReq = new Request(url, {
      headers: {
        'cookie': 'swell-data=' + encodeURIComponent(JSON.stringify({ 'swell-locale': 'fr-FR' }))
      },
    });
    const missFr = await cache.get(frReq);
    expect(missFr?.found).toBe(false); // different key due to different locale in cookie
  });

  test('client response strips content-encoding/length from stored headers', async () => {
    const req = new Request('https://site.test/pages/enc');
    // Simulate origin sending encoding we won’t preserve in body
    const res = new Response('<h1>x</h1>', {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-encoding': 'br',
        'content-length': '999',
      },
    });
    await cache.put(req, res);
    const hit = await cache.get(req);
    const h = hit!.response!.headers;
    expect(h.get('content-encoding')).toBeNull();
    expect(h.get('content-length')).toBeNull();
  });

  test('delete removes entry', async () => {
    const req = new Request('https://site.test/pages/del');
    await cache.put(req, htmlResponse('bye'));
    let before = await cache.get(req);
    expect(before?.found).toBe(true);

    await cache.delete(req);
    const after = await cache.get(req);
    expect(after?.found).toBe(false);
  });

  test('expired entry → getWithConditionals returns MISS path', async () => {
    const req = new Request('https://site.test/pages/expired304');
    await cache.put(req, htmlResponse());
    // TTL=20s, SWR=604800s (1 week) → expire after 604820s
    jest.setSystemTime(new Date('2025-01-08T00:00:21Z')); // 7 days + 21 seconds later
    const result = await cache.getWithConditionals(req);
    expect(result?.found).toBe(false);
    expect(result?.cacheable).toBe(true);
  });

  test('client response strips internal metadata headers', async () => {
    const req = new Request('https://site.test/pages/meta');
    await cache.put(req, htmlResponse());
    const hit = await cache.get(req);
    const h = hit!.response!.headers;
    expect(h.get('x-original-ttl')).toBeNull();
    expect(h.get('x-original-swr')).toBeNull();
    expect(h.get('x-cache-time')).toBeNull();
  });

  test('non-GET requests are not cacheable', async () => {
    const req = new Request('https://site.test/pages/post', { method: 'POST' });
    const res = await cache.get(req);
    expect(res).toEqual(
      expect.objectContaining({ found: false, cacheable: false }),
    );
    await cache.put(req, htmlResponse()); // should be a no-op
    const res2 = await cache.get(new Request(req.url));
    expect(res2?.found).toBe(false);
  });

  test('skip paths (e.g., /checkout) are never cacheable', async () => {
    const req = new Request('https://site.test/checkout/step');
    await cache.put(req, htmlResponse());
    const res = await cache.get(req);
    expect(res).toEqual(
      expect.objectContaining({ found: false, cacheable: false }),
    );
  });

  test('If-None-Match: "*" triggers 304 when representation exists', async () => {
    const req = new Request('https://site.test/pages/star');
    await cache.put(req, htmlResponse('<p>star</p>'));
    const starReq = new Request(req.url, { headers: { 'If-None-Match': '*' } });
    const result = await cache.getWithConditionals(starReq);
    expect(result?.notModified).toBe(true);
    expect(result?.conditional304?.status).toBe(304);
  });

  test('origin ETag is preserved and not double-quoted', async () => {
    const req = new Request('https://site.test/pages/etag-origin');
    const origin = new Response('<h1>e</h1>', {
      headers: { 'content-type': 'text/html; charset=utf-8', ETag: '"abc123"' },
    });
    await cache.put(req, origin);
    const hit = await cache.get(req);
    expect(hit!.response!.headers.get('ETag')).toBe('"abc123"');
  });

  test('invalid cacheTimeISO makes entry effectively expired (MISS)', async () => {
    const req = new Request('https://site.test/pages/bad-time');
    await cache.put(req, htmlResponse('x'));

    // Corrupt the stored entry’s timestamp
    const [onlyKey] = Array.from(backend.__store.keys());
    const ent = backend.__store.get(onlyKey);
    ent.cacheTimeISO = 'not-a-date';
    backend.__store.set(onlyKey, ent);

    const res = await cache.get(req);
    expect(res?.found).toBe(false);
    expect(res?.cacheable).toBe(true);
  });

  test('epoch isolation: entries from e1 are not visible to e2 (same backend instance)', async () => {
    const sharedBackend = makeMemoryBackend();
    const c1 = new HtmlCache('e1', sharedBackend);
    const c2 = new HtmlCache('e2', sharedBackend);

    const url = 'https://site.test/pages/epoch';
    await c1.put(new Request(url), htmlResponse('e1'));
    const missOnE2 = await c2.get(new Request(url));
    expect(missOnE2?.found).toBe(false);

    const hitOnE1 = await c1.get(new Request(url));
    expect(await hitOnE1!.response!.text()).toBe('e1');
  });

  test('304 response preserves Vary header (if set)', async () => {
    const req = new Request('https://site.test/pages/vary', {
      headers: { 'accept-language': 'en' },
    });
    await cache.put(req, htmlResponse('v'));
    // Force a HIT
    const first = await cache.get(req);
    // Pretend we set Vary in buildClientResponse (future-proof)
    const vary = first!.response!.headers.get('Vary');

    const condReq = new Request(req.url, {
      headers: { 'If-None-Match': first!.response!.headers.get('ETag')! },
    });
    const result = await cache.getWithConditionals(condReq);
    if (vary) {
      expect(result!.conditional304!.headers.get('Vary')).toBe(vary);
    }
  });

  test('X-Cache-Age reflects passage of time', async () => {
    const req = new Request('https://site.test/pages/age');
    await cache.put(req, htmlResponse());
    const t0 = await cache.get(req);
    const age0 = Number(t0!.response!.headers.get('X-Cache-Age'));
    jest.setSystemTime(new Date('2025-01-01T00:00:10Z'));
    const t1 = await cache.get(req);
    const age1 = Number(t1!.response!.headers.get('X-Cache-Age'));
    expect(age1).toBeGreaterThan(age0);
  });

  test('hop-by-hop headers are stripped from client response', async () => {
    const req = new Request('https://site.test/pages/hbh');
    const res = new Response('<h1>x</h1>', {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        connection: 'keep-alive',
        'transfer-encoding': 'chunked',
      },
    });
    await cache.put(req, res);
    const hit = await cache.get(req);
    const h = hit!.response!.headers;
    expect(h.get('connection')).toBeNull();
    expect(h.get('transfer-encoding')).toBeNull();
  });
});
