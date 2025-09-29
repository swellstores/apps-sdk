import MoneyDrop from '@/compatibility/drops/money';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.price | money }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterMoney(value: unknown) {
    const amount = getMoneyAmount(liquidSwell, value);

    return liquidSwell.renderCurrency(amount);
  };
}

export function getMoneyAmount(liquidSwell: LiquidSwell, value: unknown) {
  const { shopifyCompatibility } = liquidSwell.theme;

  if (value instanceof MoneyDrop) {
    return value.toFloat();
  } else if (shopifyCompatibility) {
    return shopifyCompatibility.fromShopifyPrice(Number(value || 0));
  }

  return Number(value || 0);
}
