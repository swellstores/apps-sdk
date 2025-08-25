import SwellProduct from './product';

import type { Swell } from '@/api';
import type { SwellData } from 'types/swell';

export default class SwellProductRecommendations extends SwellProduct {
  constructor(swell: Swell, id: string, query?: SwellData) {
    super(swell, id, { ...query, $recommendations: true });
  }
}
