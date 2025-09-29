import { getMoneyAmount } from './money';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.price | money_without_trailing_zeros }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterMoneyWithoutTrailingZeros(value: unknown) {
    const amount = getMoneyAmount(liquidSwell, value);

    return liquidSwell.renderCurrency(amount).split('.')[0].split(',')[0];
  };
}
