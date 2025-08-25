import { SwellStorefrontCollection } from '@/resources';

import type { Swell } from '@/api';
import type { SwellCollection, SwellData } from 'types/swell';
import type { SwellAddress } from './swell_types';

export default class SwellAddresses extends SwellStorefrontCollection<SwellAddress> {
  constructor(swell: Swell, query?: SwellData) {
    const { page, limit } = swell.queryParams;

    super(swell, 'accounts:addresses', { page, limit, ...query }, function () {
      return this._swell.storefront.account.listAddresses(
        this._query,
      ) as Promise<SwellCollection<SwellAddress>>;
    });
  }
}
