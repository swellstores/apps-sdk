import MoneyDrop from '@/compatibility/drops/money';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.price | money_without_trailing_zeros }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterMoneyWithoutTrailingZeros(value: unknown) {
    const amount =
      value instanceof MoneyDrop ? value.toFloat() : Number(value || 0);

    return liquidSwell.renderCurrency(amount).split('.')[0].split(',')[0];
  };
}
