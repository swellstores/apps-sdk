import { getMoneyAmount } from './money';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.price | money_without_currency }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterMoneyWithoutCurrency(value: unknown) {
    const amount = getMoneyAmount(liquidSwell, value);

    return liquidSwell.renderCurrency(amount).replace(/[^0-9.,]/g, '');
  };
}
