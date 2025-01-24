import { StorefrontResource, Swell } from './api';
import { SwellTheme } from './theme';
import { MockRecordSingleton } from './editor/resources';

describe('SwellSingletonResource', () => {
  describe('#should correctly fetch singleton resources in parallel', () => {
    it('should update settings', async () => {
      // class from the Editor
      const getMockSingleton = (singleton: string) => {
        return new Proxy(MockRecordSingleton, {
          construct(target, args) {
            // @ts-expect-error copied from the Editor
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const instance = new target(...args);
            Object.defineProperty(instance.constructor, 'name', {
              value: singleton,
            });
            Object.defineProperty(instance, '_resourceName', {
              value: singleton,
            });
            return instance;
          },
        });
      };

      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: {},
      });

      swell.storefront_url = 'test';

      swell.storefront.session.getCookie = jest.fn(() =>
        // use random key to avoid caching
        new Date().toISOString(),
      ) as jest.Mock;

      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ id: 'test' }),
        }),
      ) as jest.Mock;

      const theme = new SwellTheme(swell, {
        resources: {
          // create resources like in the Editor
          singletons: {
            // @ts-expect-error generate the same structure
            cart: getMockSingleton('CartResource'),
            // @ts-expect-error generate the same structure
            account: getMockSingleton('AccountResource'),
          },
          records: {},
        },
      });

      await Promise.all([
        theme.fetchSingletonResourceCached<StorefrontResource | {}>(
          'cart',
          () => theme.fetchCart(),
          {},
        ),

        theme.fetchSingletonResourceCached<StorefrontResource | null>(
          'account',
          () => theme.fetchAccount(),
          null,
        ),
      ]);

      // correct resources should be fetched
      const { calls } = (global.fetch as jest.Mock).mock;
      expect(calls.length).toEqual(2);
      const cartCall = calls[0] as string[];
      expect(cartCall[0]).toEqual(
        'test/resources/CartResource.json/?query=%7B%7D',
      );
      const accountCall = calls[1] as string[];
      expect(accountCall[0]).toEqual(
        'test/resources/AccountResource.json/?query=%7B%7D',
      );
    });
  });
});
