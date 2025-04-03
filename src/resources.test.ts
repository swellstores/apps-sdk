import { SwellTheme } from './theme';
import { StorefrontResource, Swell } from './api';
import { MockRecordSingleton } from './editor/resources';
import { SwellStorefrontSingleton } from './resources';

const defaultServerHeaders = {
  'swell-store-id': 'test',
  'swell-public-key': 'pk_test_key',
};

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
        serverHeaders: defaultServerHeaders,
      });

      swell.storefront_url = 'test';

      swell.storefront.session.getCookie = jest.fn(() =>
        // use random key to avoid caching
        new Date().toISOString(),
      ) as jest.Mock;

      const fetchMock = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ id: 'test' }),
        }),
      );

      global.fetch = fetchMock as jest.Mock;

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
        theme.fetchSingletonResourceCached<StorefrontResource | object>(
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
      const { calls } = fetchMock.mock;
      expect(calls).toHaveLength(2);
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
}); // describe: SwellSingletonResource

describe('SwellStorefrontSingleton', () => {
  describe('#resolve', () => {
    it('should fetch resource from source (Storefront API)', async () => {
      const cart = {
        id: 'cartid',
        total: 9.99,
      };

      const swell = new Swell({
        serverHeaders: defaultServerHeaders,
        url: new URL('https://storefront.app'),
      });

      const resource = new SwellStorefrontSingleton(swell, 'cart');

      // Simulate Storefront API to fetch the cart
      jest.spyOn(swell.storefront.cart, 'get').mockResolvedValue(cart);

      const result = await resource.resolve();

      expect(result).toEqual(cart);

      // Made storefront API call
      expect(swell.storefront.cart.get).toHaveBeenCalled();
    });

    it('should fetch resource from storefront context', async () => {
      const cart = {
        id: 'cartid',
        total: 9.99,
      };

      const swell = new Swell({
        serverHeaders: {
          ...defaultServerHeaders,
          'swell-storefront-context': JSON.stringify({ cart }),
        },
        url: new URL('https://storefront.app'),
      });

      const resource = new SwellStorefrontSingleton(swell, 'cart');

      // Simulate Storefront API to fetch the cart
      jest.spyOn(swell.storefront.cart, 'get').mockImplementation(() => {
        throw new Error('Storefront API was called');
      });

      const result = await resource.resolve();

      expect(result).toEqual(cart);

      // No storefront API call was made
      expect(swell.storefront.cart.get).not.toHaveBeenCalled();
    });
  }); // describe: #resolve
}); // describe: SwellStorefrontSingleton
