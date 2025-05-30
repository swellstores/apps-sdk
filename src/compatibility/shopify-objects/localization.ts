import { getCountryByCurrency, isObject } from '@/utils';

import type { SwellData } from 'types/swell';
import type { ShopifyCompatibility } from '../shopify';
import type {
  ShopifyCountry,
  ShopifyLocale,
  ShopifyLocalization,
} from 'types/shopify';

export default function ShopifyLocalization(
  instance: ShopifyCompatibility,
  store: SwellData,
  request: SwellData,
): ShopifyLocalization {
  const { currency: storefrontCurrency, locale: storefrontLocale } =
    instance.swell.getStorefrontLocalization();

  const requestCurrency =
    store.currencies.find(
      (currency: any) =>
        currency.code === (storefrontCurrency || request.currency),
    ) || store.currencies[0];

  const requestLocale =
    store.locales.find(
      (locale: any) => locale.code === (storefrontLocale || request.locale),
    ) || store.locales[0];

  return {
    available_countries: getAvailableCountries(store),
    available_languages: getAvailableLanguages(store),
    country:
      requestCurrency && getShopifyCountryFromCurrency(requestCurrency, store),
    language: requestLocale && getShopifyLocaleFromLocale(requestLocale, store),
    market: {
      handle: 'unknown',
      id: 0,
      metafields: {},
    },
  };
}

function getAvailableCountries(store: SwellData): ShopifyCountry[] {
  return (
    store.currencies.map((currency: any) =>
      getShopifyCountryFromCurrency(currency, store),
    ) || []
  );
}

function getAvailableLanguages(store: SwellData): ShopifyLocale[] {
  return (
    store.locales.map((locale: any) =>
      getShopifyLocaleFromLocale(locale, store),
    ) || []
  );
}

function getShopifyLocaleFromLocale(
  locale: any,
  store: SwellData,
): ShopifyLocale {
  return {
    // Shopify shop_locale object
    endonym_name: locale.name,
    iso_code: locale.code,
    name: locale.name,
    primary: locale.code === store.locale,
    root_url: store.url, // TODO
  };
}

function getShopifyCountryFromCurrency(
  currency: SwellData,
  store: SwellData,
): ShopifyCountry {
  return {
    available_languages: getAvailableLanguages(store), // All languages are available for all countries
    continent: 'North America', // TODO
    currency: {
      // Shopify currency object
      iso_code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    },
    iso_code: getCountryByCurrency(currency.code)?.iso as string,
    market: {
      // N/A
      handle: 'unknown',
      id: 0,
      metafields: {},
    },
    name: getCountryByCurrency(currency.code)?.name as string,
    'popular?': false, // TODO
    unit_system: 'metric', // TODO
  };
}

export function isLikeShopifyCountry(value: unknown): value is ShopifyCountry {
  return (
    isObject(value) &&
    Object.hasOwn(value, 'iso_code') &&
    Object.hasOwn(value, 'name') &&
    Object.hasOwn(value, 'continent') &&
    Object.hasOwn(value, 'unit_system')
  );
}
