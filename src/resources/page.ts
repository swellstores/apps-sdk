import { SwellStorefrontRecord } from '@/resources';

import type { Swell } from '@/api';
import type { SwellData } from 'types/swell';
import type { SwellPage as SwellPageType } from './swell_types';

export default class SwellPage extends SwellStorefrontRecord<SwellPageType> {
  constructor(swell: Swell, id: string, query?: SwellData) {
    super(swell, 'content/pages', id, query);

    return this._getProxy();
  }
}
