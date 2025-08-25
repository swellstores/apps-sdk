import { SwellStorefrontRecord } from '@/resources';

import type { Swell } from '@/api';
import type { SwellSubscription as SwellSubscriptionType } from './swell_types';
import type { SwellData } from 'types/swell';

export default class SwellSubscription extends SwellStorefrontRecord<SwellSubscriptionType> {
  constructor(swell: Swell, id: string, query?: SwellData) {
    super(swell, 'accounts:subscriptions', id, query, function () {
      return this._swell.storefront.subscriptions.get(this._id, this._query);
    });
  }
}
