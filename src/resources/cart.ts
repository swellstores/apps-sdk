import { SwellStorefrontSingleton } from '@/resources';

import type { Swell } from '@/api';
import type { SwellCart as SwellCartType } from './swell_types';

export default class SwellCart extends SwellStorefrontSingleton<SwellCartType> {
  constructor(swell: Swell) {
    super(swell, 'cart');

    return this._getProxy();
  }
}
