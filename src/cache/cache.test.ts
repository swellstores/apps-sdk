import { Keyv } from 'keyv';

import { Cache } from './cache';

describe('Cache', () => {
  let counter = 0;
  function fetchFn() {
    // increment the counter for each fetch from source
    counter += 1;
    return Promise.resolve(counter);
  }

  beforeEach(() => {
    counter = 0;
  });

  describe('#fetch', () => {
    it('fetches a cache entry', async () => {
      const cache = new Cache();

      let result = await cache.fetch('foo', fetchFn);
      expect(result).toEqual(1); // fetch from source

      result = await cache.fetch('foo', fetchFn);
      expect(result).toEqual(1); // fetch from cache

      result = await cache.fetch('bar', fetchFn);
      expect(result).toEqual(2); // fetch from source

      result = await cache.fetch('bar', fetchFn);
      expect(result).toEqual(2); // fetch from cache
    });

    it('fetches a null cache entry', async () => {
      const fn = () => {
        counter += 1;
        return null;
      };

      const cache = new Cache();

      let result = await cache.fetch('foo', fn);
      expect(result).toEqual(null); // fetch from source
      expect(counter).toEqual(1);

      result = await cache.fetch('foo', fn);
      expect(result).toEqual(null); // fetch from cache
      expect(counter).toEqual(1);
    });

    it('does not cache an undefined result', async () => {
      const fn = () => {
        counter += 1;
        return undefined;
      };

      const cache = new Cache();

      let result = await cache.fetch('foo', fn);
      expect(result).toBeUndefined(); // fetch from source
      expect(counter).toEqual(1);

      result = await cache.fetch('foo', fn);
      expect(result).toBeUndefined(); // fetch from source
      expect(counter).toEqual(2);
    });

    it('expires cache after TTL', async () => {
      const cache = new Cache({
        ttl: 100, // ms
      });

      let result = await cache.fetch('foo', fetchFn);
      expect(counter).toEqual(1); // fetch from source

      result = await cache.fetch('foo', fetchFn);
      expect(result).toEqual(1); // fetch from cache

      // wait for expiry
      await new Promise((resolve, reject) => {
        try {
          setTimeout(resolve, 101);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      result = await cache.fetch('foo', fetchFn);
      expect(result).toEqual(2); // fetch from source
    });
  }); // describe: #fetch

  describe('#get/#set', () => {
    it('gets a cache entry', async () => {
      const cache = new Cache();

      let result = await cache.get('foo');
      expect(result).toBeUndefined();

      await cache.set('foo', 'bar');

      result = await cache.get('foo');
      expect(result).toEqual('bar');
    });

    it('sets/gets a null cache entry', async () => {
      const cache = new Cache();
      await cache.set('foo', 'bar');

      let result = await cache.get('foo');
      expect(result).toEqual('bar');

      await cache.set('foo', null);

      result = await cache.get('foo');
      expect(result).toBeNull();
    });

    it('sets/gets an undefined cache entry', async () => {
      const cache = new Cache();
      await cache.set('foo', 'bar');

      let result = await cache.get('foo');
      expect(result).toEqual('bar');

      await cache.set('foo', undefined);

      result = await cache.get('foo');
      expect(result).toBeUndefined();
    });

    describe('when shared cache is namespaced', () => {
      it('writes cache entries to different namespaces', async () => {
        // Initialize a shared cache store with two namespaced cache clients.
        const sharedSource = new Map();
        const cacheA = new Cache({
          stores: [new Keyv(sharedSource, { namespace: 'a' })],
        });
        const cacheB = new Cache({
          stores: [new Keyv(sharedSource, { namespace: 'b' })],
        });

        // set different values for the same key in each namespace
        await cacheA.set('foo', 'bar');
        await cacheB.set('foo', 'baz');

        // expect: different values for caches
        let result = await cacheA.get('foo');
        expect(result).toEqual('bar');
        result = await cacheB.get('foo');
        expect(result).toEqual('baz');
        expect(Array.from(sharedSource.keys())).toEqual(['a:foo', 'b:foo']);
      });
    }); // describe: when cache is namespaced
  }); // describe: #get/set

  describe('#flush', () => {
    it('flushes an individual cache entry', async () => {
      const cache = new Cache();

      let result = await cache.fetch('foo', fetchFn);
      expect(result).toEqual(1); // fetch from source

      result = await cache.fetch('bar', fetchFn);
      expect(result).toEqual(2); // fetch from source

      await cache.flush('foo');

      result = await cache.fetch('foo', fetchFn);
      expect(result).toEqual(3); // fetch from source

      result = await cache.fetch('bar', fetchFn);
      expect(result).toEqual(2); // still cached
    });

    it('flushes the entry within the namespace', async () => {
      const cache1 = new Cache();
      const cache2 = new Cache();

      let result = await cache1.fetch('foo', fetchFn);
      expect(result).toEqual(1); // fetch from source

      result = await cache2.fetch('foo', fetchFn);
      expect(result).toEqual(2); // fetch from source

      await cache1.flush('foo');

      result = await cache1.fetch('foo', fetchFn);
      expect(result).toEqual(3); // fetch from source

      result = await cache2.fetch('foo', fetchFn);
      expect(result).toEqual(2); // still cached
    });

    describe('when shared cache is namespaced', () => {
      it('flushes cache entries specific to a namespace', async () => {
        // Initialize a shared cache store with two namespaced cache clients.
        const sharedSource = new Map();
        const cacheA = new Cache({
          stores: [new Keyv(sharedSource, { namespace: 'a' })],
        });
        const cacheB = new Cache({
          stores: [new Keyv(sharedSource, { namespace: 'b' })],
        });

        // set different values for the same key in each namespace
        await cacheA.set('foo', 'bar');
        await cacheB.set('foo', 'baz');

        // expect: different values for caches
        let result = await cacheA.get('foo');
        expect(result).toEqual('bar');
        result = await cacheB.get('foo');
        expect(result).toEqual('baz');
        expect(Array.from(sharedSource.keys())).toEqual(['a:foo', 'b:foo']);

        // only flush entry from namespace B.
        await cacheB.flush('foo');

        // expect: different values for caches
        result = await cacheA.get('foo');
        expect(result).toEqual('bar');
        result = await cacheB.get('foo');
        expect(result).toBeUndefined();
        expect(Array.from(sharedSource.keys())).toEqual(['a:foo']);
      });
    }); // describe: when shared cache is namespaced
  }); // describe: #flush

  describe('#flushAll', () => {
    it('flushes all entries', async () => {
      const cacheA = new Cache();
      const cacheB = new Cache();

      let result1 = await cacheA.fetch('a1', fetchFn);
      let result2 = await cacheA.fetch('a2', fetchFn);
      let result3 = await cacheB.fetch('b1', fetchFn);

      expect(result1).toEqual(1); // fetch from source
      expect(result2).toEqual(2); // fetch from source
      expect(result3).toEqual(3); // fetch from source

      await cacheA.flushAll();

      result1 = await cacheA.fetch('a1', fetchFn);
      result2 = await cacheA.fetch('a2', fetchFn);
      result3 = await cacheB.fetch('b1', fetchFn);

      expect(result1).toEqual(4); // fetch from source
      expect(result2).toEqual(5); // fetch from source
      expect(result3).toEqual(3); // still cached
    });

    describe('when shared cache is namespaced', () => {
      it('flushes cache entries across namespaces', async () => {
        // Initialize a shared cache store with two namespaced cache clients.
        const sharedSource = new Map();
        const cacheA = new Cache({
          stores: [new Keyv(sharedSource, { namespace: 'a' })],
        });
        const cacheB = new Cache({
          stores: [new Keyv(sharedSource, { namespace: 'b' })],
        });

        // set different values for the same key in each namespace
        await cacheA.set('foo', 'bar');
        await cacheB.set('foo', 'baz');

        // expect: different values for caches
        let result = await cacheA.get('foo');
        expect(result).toEqual('bar');
        result = await cacheB.get('foo');
        expect(result).toEqual('baz');
        expect(Array.from(sharedSource.keys())).toEqual(['a:foo', 'b:foo']);

        // flushAll clears all namespaces
        await cacheB.flushAll();

        result = await cacheA.get('foo');
        expect(result).toBeUndefined();
        result = await cacheB.get('foo');
        expect(result).toBeUndefined();
        expect(Array.from(sharedSource.keys())).toEqual([]);
      });
    }); // describe: when shared cache is namespaced
  }); // describe: #flushAll
}); // describe: Cache
