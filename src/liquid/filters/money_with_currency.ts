import { getMoneyAmount } from './money';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.price | money_with_currency }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterMoneyWithCurrency(value: unknown) {
    const { currency } = liquidSwell.theme.swell.getStorefrontLocalization();
    const amount = getMoneyAmount(liquidSwell, value);

    return `${liquidSwell.renderCurrency(amount)} ${currency?.toUpperCase()}`;
  };
}
