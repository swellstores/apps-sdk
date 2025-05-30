import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyCurrency } from 'types/shopify';
import type { SwellCurrency } from 'types/swell';

export default function ShopifyCurrency(
  instance: ShopifyCompatibility,
  currencyCode: string,
): ShopifyCurrency {
  const swellCurrency = getSwellCurrency(instance, currencyCode);

  return {
    iso_code: swellCurrency.code,
    name: swellCurrency.name,
    symbol: swellCurrency.symbol,
  };
}

export function getSwellCurrency(
  instance: ShopifyCompatibility,
  currencyCode: string,
): SwellCurrency {
  const store =
    instance.theme.globals.store ??
    (instance.swell.storefront.settings as any).state.store;

  return (
    store.currencies.find(
      (currency: any) => currency.code === currencyCode,
    ) ?? {
      code: 'USD',
      symbol: '$',
      name: 'US Dollar',
      decimals: 2,
      rate: 1,
      priced: true,
      type: 'base',
    }
  );
}
