import type { Swell } from '@/api';
import { SwellStorefrontSingleton } from '@/resources';
import type {
  StorefrontResourceGetter,
  SwellData,
  SwellRecord,
} from 'types/swell';

export class SwellAccount<
  T extends SwellData = SwellRecord,
> extends SwellStorefrontSingleton<T> {
  constructor(swell: Swell, getter?: StorefrontResourceGetter<T>) {
    super(swell, 'account', getter);

    return this._getProxy();
  }
}
