import type { Swell } from '@/api';
import { SwellStorefrontRecord } from '@/resources';
import type {
  StorefrontResourceGetter,
  SwellData,
  SwellRecord,
} from 'types/swell';

export class SwellOrder<
  T extends SwellData = SwellRecord,
> extends SwellStorefrontRecord<T> {
  constructor(
    swell: Swell,
    id: string,
    query: SwellData = {},
    getter?: StorefrontResourceGetter<T>,
  ) {
    super(swell, 'orders', id, query, getter);

    return this._getProxy();
  }
}
