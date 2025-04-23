import { Swell } from './api';

describe('Swell', () => {
  describe('concerning headers', () => {
    it('sets headers from serverHeaders (SwellData)', () => {
      const swell = new Swell({
        serverHeaders: {
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
          'foo': 'bar',
        },
        url: new URL('https://storefront.app'),
      }); 

      expect(swell.headers).toEqual({
        'swell-public-key': 'publickey',
        'swell-store-id': 'test',
        'foo': 'bar',
      });

      expect(swell.swellHeaders).toEqual({
        'public-key': 'publickey',
        'store-id': 'test',
      });
    });

    it('sets headers from serverHeaders (Headers)', () => {
      const swell = new Swell({
        serverHeaders: new Headers({
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
          'foo': 'bar',
        }),
        url: new URL('https://storefront.app'),
      }); 

      expect(swell.headers).toEqual({
        'swell-public-key': 'publickey',
        'swell-store-id': 'test',
        'foo': 'bar',
      });

      expect(swell.swellHeaders).toEqual({
        'public-key': 'publickey',
        'store-id': 'test',
      });
    });

    it('sets headers from headers and swellHeaders', () => {
      const swell = new Swell({
        headers: {
          'foo': 'bar',
        },
        swellHeaders: {
          'public-key': 'publickey',
          'store-id': 'test',
        },
        url: new URL('https://storefront.app'),
      }); 

      expect(swell.headers).toEqual({
        'foo': 'bar',
      });

      expect(swell.swellHeaders).toEqual({
        'public-key': 'publickey',
        'store-id': 'test',
      });
    });
  }); // concerning headers

  describe('concerning storefrontContext', () => {
    it('sets empty storefront context by default', () => {
      const swell = new Swell({
        serverHeaders: {
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
        },
        url: new URL('https://storefront.app'),
      });

      expect(swell.storefrontContext).toEqual({});
    });

    it('sets storefront context from swellHeaders', () => {
      const context = {
        cart: {
          id: 'cartid',
          total: 9.99,
        },
        account: null,
      };

      const swell = new Swell({
        serverHeaders: {
          'swell-public-key': 'publickey',
          'swell-store-id': 'test',
          'swell-storefront-context': encodeURIComponent(
            JSON.stringify(context),
          ),
        },
        url: new URL('https://storefront.app'),
      });

      expect(swell.storefrontContext).toEqual(context);
    });
  }); // concerning storefrontContext
});
