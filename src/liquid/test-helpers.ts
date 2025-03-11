import { SwellTheme } from '@/theme';

import { LiquidSwell } from './';

type DescribeLiquidCallbackType = (
  render: (template: string, data?: any) => Promise<string>,
  liquid: LiquidSwell,
) => void;

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

const liquid = new LiquidSwell({
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

function describeLiquid(
  description: string,
  callback: DescribeLiquidCallbackType,
) {
  describe(description, () => {
    const parse = liquid.parseAndRender.bind(liquid);

    callback(parse, liquid);
  });
}

export function describeFilter(
  name: string,
  callback: DescribeLiquidCallbackType,
) {
  describeLiquid(`Liquid filter: ${name}`, callback);
}

export function describeTag(
  name: string,
  callback: DescribeLiquidCallbackType,
) {
  describeLiquid(`Liquid tag: ${name}`, callback);
}

export function removeSpaces(value: string) {
  return value.replace(/\s+(?=<)|(?<=>)\s+/g, '');
}
