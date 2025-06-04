import MoneyDrop from '@/compatibility/drops/money';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.price | money }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterMoney(value: unknown) {
    const amount =
      value instanceof MoneyDrop ? value.toFloat() : Number(value || 0);

    return liquidSwell.renderCurrency(amount);
  };
}
