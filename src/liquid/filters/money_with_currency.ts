import MoneyDrop from '@/compatibility/drops/money';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.price | money_with_currency }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterMoneyWithCurrency(value: unknown) {
    const { currency } = liquidSwell.theme.swell.getStorefrontLocalization();

    const amount =
      value instanceof MoneyDrop ? value.toFloat() : Number(value || 0);

    return `${liquidSwell.renderCurrency(amount)} ${currency?.toUpperCase()}`;
  };
}
