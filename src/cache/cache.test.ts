import { Keyv } from 'keyv';

import { Cache } from './cache';

describe('Cache', () => {

  describe('#fetch', () => {
    it('always fetches fresh data ignoring cache', async () => {
      const cache = new Cache();
      let fetchCount = 0;
      const trackingFn = () => {
        fetchCount++;
        return `fetch-${fetchCount}`;
      };

      // Pre-populate cache with stale data
      await cache.set('test-key', 'stale-cached-value');
      
      // Verify cache has the stale value
      expect(await cache.get('test-key')).toEqual('stale-cached-value');

      // Fetch should ignore cache and call the function
      const result = await cache.fetch('test-key', trackingFn);
      expect(result).toEqual('fetch-1');
      expect(fetchCount).toEqual(1);
      
      // Verify cache was updated with fresh value
      expect(await cache.get('test-key')).toEqual('fetch-1');

      // Another fetch should call the function again (not use cache)
      const result2 = await cache.fetch('test-key', trackingFn);
      expect(result2).toEqual('fetch-2');
      expect(fetchCount).toEqual(2);
    });

    it('updates cache after fetching for future get/fetchSWR calls', async () => {
      const cache = new Cache();
      let callCount = 0;
      const incrementFn = () => {
        callCount++;
        return `value-${callCount}`;
      };

      // Fetch fresh data
      const fetchResult = await cache.fetch('key', incrementFn);
      expect(fetchResult).toEqual('value-1');
      expect(callCount).toEqual(1);

      // Direct cache get should return the fresh value
      const cachedValue = await cache.get('key');
      expect(cachedValue).toEqual('value-1');

      // fetchSWR should return cached value immediately
      // (it may refresh in background, but returns cache first)
      const swrResult = await cache.fetchSWR('key', incrementFn);
      expect(swrResult).toEqual('value-1');
      
      // Note: fetchSWR may trigger background refresh, so we don't check callCount here
      // The important thing is it returned the cached value
    });

    it('deduplicates concurrent requests with same key', async () => {
      const cache = new Cache();
      let executionCount = 0;
      const slowFn = async () => {
        executionCount++;
        const currentCount = executionCount;
        await new Promise(resolve => setTimeout(resolve, 20));
        return `execution-${currentCount}`;
      };

      // Make 5 concurrent requests with same key
      const promises = Array(5).fill(null).map(() => 
        cache.fetch('same-key', slowFn)
      );
      
      const results = await Promise.all(promises);
      
      // All should return the same value from single execution
      results.forEach(result => {
        expect(result).toEqual('execution-1');
      });
      
      // Function should have been called only once
      expect(executionCount).toEqual(1);
    });


    it('respects isCacheable=false parameter', async () => {
      const cache = new Cache();
      const fetchValue = () => 'test-value';

      // Fetch with isCacheable=false
      const result = await cache.fetch('no-cache-key', fetchValue, undefined, false);
      expect(result).toEqual('test-value');

      // Cache should remain empty
      const cached = await cache.get('no-cache-key');
      expect(cached).toBeUndefined();

      // Now fetch with isCacheable=true (default)
      await cache.fetch('cache-key', fetchValue);
      
      // This one should be cached
      const cached2 = await cache.get('cache-key');
      expect(cached2).toEqual('test-value');
    });

    it('handles null and undefined values correctly', async () => {
      const cache = new Cache();
      
      // Test null value
      const returnNull = () => null;
      const nullResult = await cache.fetch('null-key', returnNull);
      expect(nullResult).toBeNull();
      
      // fetch should update cache, fetchSWR should return the cached null
      let callCount = 0;
      const countingNull = () => {
        callCount++;
        return null;
      };
      
      await cache.fetch('null-test', countingNull);
      expect(callCount).toEqual(1);
      
      // fetchSWR should use cached value (even though it's null)
      const cachedNull = await cache.fetchSWR('null-test', countingNull);
      expect(cachedNull).toBeNull();
      // The function might be called again due to SWR background refresh
      // but the important thing is it returned null immediately
      
      // Test undefined value  
      const returnUndefined = () => undefined;
      const undefResult = await cache.fetch('undef-key', returnUndefined);
      expect(undefResult).toBeUndefined();
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

      // Set cache entries
      await cache.set('foo', 'value1');
      await cache.set('bar', 'value2');

      // Verify both are cached
      expect(await cache.get('foo')).toEqual('value1');
      expect(await cache.get('bar')).toEqual('value2');

      // Flush only 'foo'
      await cache.flush('foo');

      // Verify 'foo' is gone but 'bar' remains
      expect(await cache.get('foo')).toBeUndefined();
      expect(await cache.get('bar')).toEqual('value2');
    });

    it('flushes the entry within the namespace', async () => {
      const cache1 = new Cache();
      const cache2 = new Cache();

      // Set same key in both caches
      await cache1.set('foo', 'cache1-value');
      await cache2.set('foo', 'cache2-value');

      // Flush from cache1
      await cache1.flush('foo');

      // Verify cache1 entry is gone but cache2 remains
      expect(await cache1.get('foo')).toBeUndefined();
      expect(await cache2.get('foo')).toEqual('cache2-value');
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

      // Set cache entries
      await cacheA.set('a1', 'value1');
      await cacheA.set('a2', 'value2');
      await cacheB.set('b1', 'value3');

      // Verify all are cached
      expect(await cacheA.get('a1')).toEqual('value1');
      expect(await cacheA.get('a2')).toEqual('value2');
      expect(await cacheB.get('b1')).toEqual('value3');

      // Flush all from cacheA
      await cacheA.flushAll();

      // Verify cacheA entries are gone but cacheB remains
      expect(await cacheA.get('a1')).toBeUndefined();
      expect(await cacheA.get('a2')).toBeUndefined();
      expect(await cacheB.get('b1')).toEqual('value3');
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
