import { Swell } from './api';
import { SwellTheme } from './theme';
import { SwellStorefrontSingleton } from './resources';
import { ShopifyCompatibility } from './compatibility/shopify';

import type { ShopifySettingsData } from 'types/shopify';

const defaultServerHeaders = {
  'swell-store-id': 'test',
  'swell-public-key': 'pk_test_key',
};

describe('SwellTheme', () => {
  describe('#updateSettings', () => {
    it('should update settings', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: defaultServerHeaders,
      });

      const theme = new SwellTheme(swell);

      const form = {
        field1: { value: 'value1' },
        field2: { value: 'value2' },
        field3: { value: null },
      };

      const config = {
        field1: 'old1',
        field2: 'old2',
        field3: 'old3',
        field4: 'old4',
      };

      const settings = theme.updateSettings(form, config);

      expect(settings).toEqual({
        field1: 'value1',
        field2: 'value2',
        field3: 'old3',
        field4: 'old4',
      });
    });

    it('should add new settings', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: defaultServerHeaders,
      });

      const theme = new SwellTheme(swell);

      const form = {
        field1: { value: 'value1' },
        field2: { value: 'value2' },
        field3: { value: null },
        extra: { value: 'value3' },
      };

      const config = {
        field1: 'old1',
        field2: 'old2',
        field3: 'old3',
        field4: 'old4',
      };

      const settings = theme.updateSettings(form, config);

      expect(settings).toEqual({
        field1: 'value1',
        field2: 'value2',
        field3: 'old3',
        field4: 'old4',
        extra: 'value3',
      });
    });

    it('should update settings (shopify compatibility: current => object)', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: defaultServerHeaders,
      });

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const form = {
        field1: { value: 'value1' },
        field2: { value: 'value2' },
        field3: { value: null },
      };

      const config: ShopifySettingsData = {
        current: {
          field1: 'old1',
          field2: 'old2',
          field3: 'old3',
          field4: 'old4',
        },
        presets: {},
        platform_customizations: {
          custom_css: [],
        },
      };

      const settings = theme.updateSettings(form, config);

      expect(settings).toEqual({
        current: {
          field1: 'value1',
          field2: 'value2',
          field3: 'old3',
          field4: 'old4',
        },
        presets: {},
        platform_customizations: {
          custom_css: [],
        },
      });
    });

    it('should update settings (shopify compatibility: current => string)', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: defaultServerHeaders,
      });

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const form = {
        field1: { value: 'value1' },
        field2: { value: 'value2' },
        field3: { value: null },
      };

      const config: ShopifySettingsData = {
        current: 'preset_name',
        presets: {
          preset_name: {
            field1: 'old1',
            field2: 'old2',
            field3: 'old3',
            field4: 'old4',
          },
        },
        platform_customizations: {
          custom_css: [],
        },
      };

      const settings = theme.updateSettings(form, config);

      expect(settings).toEqual({
        current: 'preset_name',
        presets: {
          preset_name: {
            field1: 'value1',
            field2: 'value2',
            field3: 'old3',
            field4: 'old4',
          },
        },
        platform_customizations: {
          custom_css: [],
        },
      });
    });
  });

  describe('#getPageConfigPath', () => {
    it('should return page config path', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: defaultServerHeaders,
      });

      const theme = new SwellTheme(swell);

      expect(theme.getPageConfigPath('index')).toStrictEqual(
        'theme/templates/index.json',
      );
    });

    it('should return page config path (shopify compatibility)', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: defaultServerHeaders,
        shopifyCompatibilityConfig: {
          forms: [],
          object_resources: [],
          page_resources: [],
          page_routes: {},
          page_types: { index: 'test_index' },
        },
      });

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      expect(theme.getPageConfigPath('index')).toStrictEqual(
        'theme/templates/test_index.json',
      );
    });
  });

  describe('#preloadSingletons', () => {
    function createTheme() {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: defaultServerHeaders,
        isEditor: true,
      });
      const getCart = jest.fn(async () => ({ id: 'cart-1', items: [] }));
      const getAccount = jest.fn(async () => ({ id: 'account-1' }));

      class CartResource extends SwellStorefrontSingleton {
        constructor(swell: Swell) {
          super(swell, 'cart', getCart);
        }
      }

      class AccountResource extends SwellStorefrontSingleton {
        constructor(swell: Swell) {
          super(swell, 'account', getAccount);
        }
      }

      const theme = new SwellTheme(swell, {
        resources: {
          singletons: { cart: CartResource, account: AccountResource },
          records: {},
        },
      });

      return { theme, getCart, getAccount };
    }

    it('starts loading the cart and account', async () => {
      const { theme, getCart, getAccount } = createTheme();

      theme.preloadSingletons();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(getCart).toHaveBeenCalledTimes(1);
      expect(getAccount).toHaveBeenCalledTimes(1);
    });

    it('lets fetchCart and fetchAccount use the loaded resources once', async () => {
      const { theme, getCart, getAccount } = createTheme();

      theme.preloadSingletons();
      const cart = await theme.fetchCart();
      const account = await theme.fetchAccount();

      expect(await cart.id).toBe('cart-1');
      expect(await account?.id).toBe('account-1');
      expect(getCart).toHaveBeenCalledTimes(1);
      expect(getAccount).toHaveBeenCalledTimes(1);

      await theme.fetchCart();
      expect(getCart).toHaveBeenCalledTimes(2);
    });
  });
});
