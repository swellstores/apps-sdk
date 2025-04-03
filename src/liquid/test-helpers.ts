import { LiquidSwell } from './';

import type { Swell } from '@/api';
import type { SwellTheme } from '@/theme';

type DescribeLiquidCallbackType = (
  render: (template: string, data?: any) => Promise<string>,
  liquid: LiquidSwell,
) => void;

function createSwellLiquid(): LiquidSwell {
  const swell = {
    getStorefrontLocalization: jest.fn(() => ({
      currency: 'USD',
      locale: 'en-US',
    })),
  };

  const theme = {
    swell,
    globals: {},
    formData: {},
    getFormConfig: jest.fn((_formType) => ({
      id: 'test_form',
      url: '/test',
    })),
  } as unknown as jest.Mocked<SwellTheme>;

  return new LiquidSwell({
    theme,
    getThemeConfig: jest.fn(),
    getThemeTemplateConfigByType: jest.fn(),
    getAssetUrl: jest.fn(async (asset) => `assets/${asset}`),
    renderTemplate: jest.fn(),
    renderTemplateString: jest.fn(),
    renderPageSections: jest.fn(),
    renderTranslation: jest.fn(async (key) => `Translation: ${key}`),
    renderCurrency: jest.fn((amount) => `$${amount}`),
    isEditor: true,
  });
}

function describeLiquid(
  description: string,
  callback: DescribeLiquidCallbackType,
): void {
  describe(description, () => {
    const liquid = createSwellLiquid();
    const parse = liquid.parseAndRender.bind(liquid);

    callback(parse, liquid);
  });
}

export function describeFilter(
  name: string,
  callback: DescribeLiquidCallbackType,
): void {
  describeLiquid(`Liquid filter: ${name}`, callback);
}

export function describeTag(
  name: string,
  callback: DescribeLiquidCallbackType,
): void {
  describeLiquid(`Liquid tag: ${name}`, callback);
}

export function removeSpaces(value: string): string {
  return value.replace(/\s+(?=<)|(?<=>)\s+/g, '');
}

export function setStorefrontLocalization(
  swell: Swell,
  locale: string,
  currency: string,
): void {
  const currencyApi = swell.storefront.currency as any;
  currencyApi.state = { code: currency };
  currencyApi.code = currency;
  currencyApi.locale = locale;

  const localeApi = swell.storefront.locale as any;
  localeApi.state = { code: locale };
  localeApi.code = locale;
}
