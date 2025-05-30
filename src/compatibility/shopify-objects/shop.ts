import { ShopifyResource, defer } from './resource';
import { ShopifyCompatibility } from '../shopify';

import type { SwellData } from 'types/swell';
import type { ShopifyAddress, ShopifyBrand, ShopifyShop } from 'types/shopify';

export default function ShopifyShop(
  instance: ShopifyCompatibility,
  store: SwellData,
): ShopifyResource<ShopifyShop> {
  const currency = store.currencies.find(
    (currency: any) => currency.code === store.currency,
  ) ?? { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 };

  return new ShopifyResource<ShopifyShop>({
    accepts_gift_cards: true, // TODO
    address: {} as ShopifyAddress, // TODO
    brand: {} as ShopifyBrand, // TODO
    collections_count: defer<number>(async () => {
      const { count } = await instance.swell.storefront.categories.list({
        limit: 1,
      });

      return count;
    }),
    currency: store.currency as string,
    customer_accounts_enabled: true, // TODO: consider if we should provide a standard option
    customer_accounts_optional: true, // TODO
    description: store.description as string, // TODO
    domain: store.url.replace(/^http[s]?:\/\//, '') as string,
    email: store.support_email as string,
    enabled_currencies: store.currencies.map((currency: any) => ({
      // currency object
      iso_code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    })),
    enabled_locales: [],
    enabled_payment_types: [], // TODO
    id: store.id as number,
    locale: store.locale as string,
    metafields: {},
    metaobjects: {},
    money_format: `${currency.symbol}{{amount}}`,
    money_with_currency_format: `${currency.symbol}{{amount}} ${currency.code}`,
    name: store.name as string,
    password_message: '', // TODO
    permanent_domain: `${store.id}.swell.store`,
    phone: store.support_phone as string,
    published_locales: store.locales.map((locale: any) => ({
      // shop_locale object
      endonym_name: locale.name,
      iso_code: locale.code,
      name: locale.name,
      primary: locale.code === store.locale,
      root_url: store.url, // TODO
    })),
    secure_url: store.url as string,
    types: [], // TODO: product types
    url: store.url as string,
    vendors: [], // TODO: product vendors

    policies: [], // TODO
    privacy_policy: undefined, // TODO
    refund_policy: undefined, // TODO
    shipping_policy: undefined, // TODO
    subscription_policy: undefined, // TODO
    terms_of_service: undefined, // TODO
    taxes_included: false,
    products_count: defer<number>(async () => {
      const { count } = await instance.swell.storefront.products.list({
        limit: 1,
      });

      return count;
    }),
  });
}
