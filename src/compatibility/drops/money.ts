import { Drop } from 'liquidjs';

import type { ShopifyCurrency, ShopifyMoney } from 'types/shopify';

export default class MoneyDrop extends Drop implements ShopifyMoney {
  constructor(
    public value: number,
    public decimals: number,
    public currency: ShopifyCurrency,
  ) {
    super();
  }

  valueOf() {
    return this.value * 10 ** this.decimals;
  }

  toFloat() {
    return this.value;
  }
}
