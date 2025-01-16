import { Swell } from './api';
import { SwellTheme } from './theme';
import { ShopifyCompatibility } from './compatibility/shopify';

import type { ShopifySettingsData } from 'types/shopify';

describe('SwellTheme', () => {
  describe('#updateSettings', () => {
    it('should update settings', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: {},
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

      expect(settings).toMatchObject({
        field1: 'value1',
        field2: 'value2',
        field3: 'old3',
        field4: 'old4',
      });
    });

    it('should update settings (shopify compatibility: current => object)', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: {},
      });

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const form = {
        field1: { value: 'value1' },
        field2: { value: 'value2' },
        field3: { value: null },
        extra: { value: 'value3' },
      };

      const config: ShopifySettingsData = {
        current: {
          field1: 'old1',
          field2: 'old2',
          field3: 'old3',
          field4: 'old4',
        },
        presets: {},
      };

      const settings = theme.updateSettings(form, config);

      expect(settings).toMatchObject({
        current: {
          field1: 'value1',
          field2: 'value2',
          field3: 'old3',
          field4: 'old4',
        },
        presets: {},
      });
    });

    it('should update settings (shopify compatibility: current => string)', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: {},
      });

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const form = {
        field1: { value: 'value1' },
        field2: { value: 'value2' },
        field3: { value: null },
        extra: { value: 'value3' },
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
      };

      const settings = theme.updateSettings(form, config);

      expect(settings).toMatchObject({
        current: 'preset_name',
        presets: {
          preset_name: {
            field1: 'value1',
            field2: 'value2',
            field3: 'old3',
            field4: 'old4',
          },
        },
      });
    });
  });

  describe('#getPageConfigPath', () => {
    it('should return page config path', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: {},
      });

      const theme = new SwellTheme(swell);

      expect(theme.getPageConfigPath('index')).toStrictEqual(
        'theme/templates/index.json',
      );
    });

    it('should return page config path (shopify compatibility)', () => {
      const swell = new Swell({
        url: 'http://localhost',
        serverHeaders: {},
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
});
