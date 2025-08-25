import { SwellStorefrontCollection } from '@/resources';

import type { Swell } from '@/api';
import type { SwellSubscription } from './swell_types';
import type { SwellCollection, SwellData } from 'types/swell';

export default class SwellSubscriptions extends SwellStorefrontCollection<SwellSubscription> {
  constructor(swell: Swell, query?: SwellData) {
    const { page, limit } = swell.queryParams;

    super(
      swell,
      'accounts:subscriptions',
      { page, limit, ...query },
      function () {
        return this._swell.storefront.subscriptions.list(
          this._query,
        ) as Promise<SwellCollection<SwellSubscription>>;
      },
    );
  }
}
