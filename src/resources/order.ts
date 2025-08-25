import { SwellStorefrontRecord } from '@/resources';

import type { Swell } from '@/api';
import type { SwellOrder as SwellOrderType } from './swell_types';
import type { SwellData } from 'types/swell';

export default class SwellOrder extends SwellStorefrontRecord<SwellOrderType> {
  constructor(swell: Swell, id: string, query?: SwellData) {
    super(swell, 'accounts:orders', id, query, function () {
      return this._swell.storefront.account.getOrder(this._id);
    });

    return this._getProxy();
  }
}
