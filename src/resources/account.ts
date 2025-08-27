import { SwellStorefrontSingleton } from '@/resources';

import type { Swell } from '@/api';
import type {
  SwellAccount as SwellAccountType,
  SwellAddress,
  SwellOrder,
  SwellSubscription,
} from './swell_types';
import type { SwellCollection } from 'types/swell';

import SwellAddresses from './addresses';
import SwellOrders from './orders';
import SwellSubscriptions from './subscriptions';

export default class SwellAccount extends SwellStorefrontSingleton<SwellAccountType> {
  constructor(swell: Swell) {
    super(swell, 'account', async function () {
      // Instead of this._defaultGetter().call(this), directly call the resource
      const resource = this.getResourceObject();
      const account = await resource.get() as SwellAccountType | null;

      if (!account) {
        return null;
      }

      account.addresses = new SwellAddresses(
        this._swell,
      ) as SwellCollection<SwellAddress>;

      account.orders = new SwellOrders(
        this._swell,
      ) as SwellCollection<SwellOrder>;

      account.subscriptions = new SwellSubscriptions(
        this._swell,
      ) as SwellCollection<SwellSubscription>;

      return account;
    });

    return this._getProxy();
  }
}
