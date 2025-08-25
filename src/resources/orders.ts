import { SwellStorefrontCollection } from '@/resources';

import type { Swell } from '@/api';
import type { SwellOrder } from './swell_types';
import type { SwellCollection, SwellData } from 'types/swell';

export default class SwellOrders extends SwellStorefrontCollection<SwellOrder> {
  constructor(swell: Swell, query?: SwellData) {
    const { page, limit } = swell.queryParams;

    super(swell, 'accounts:orders', { page, limit, ...query }, function () {
      return this._swell.storefront.account.listOrders(this._query) as Promise<
        SwellCollection<SwellOrder>
      >;
    });
  }
}
