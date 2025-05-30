import MoneyDrop from '../drops/money';

import { getSwellCurrency } from './currency';

import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyMoney } from 'types/shopify';

export default function ShopifyMoney(
  instance: ShopifyCompatibility,
  value: number,
): ShopifyMoney {
  const code = instance.theme.globals.store.currency;
  const currency = getSwellCurrency(instance, code);

  // For currencies without decimal places, two zeros are added.
  const decimals = currency.decimals || 2;

  return new MoneyDrop(value * decimals, decimals, {
    iso_code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
  });
}
