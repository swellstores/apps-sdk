import { StorefrontResource } from '@/resources';

import { getProductFilters } from './product_helpers';

import type { Swell } from '@/api';
import type { SwellSearch as SwellSearchType } from './swell_types';

export default class SwellSearch extends StorefrontResource<SwellSearchType> {
  constructor(swell: Swell, query?: string) {
    super(async () => {
      const performed = String(query || '').length > 0;

      const productFilters = await getProductFilters(
        swell,
        performed ? { search: query } : undefined,
      );

      return {
        query,
        performed,
        ...productFilters,
      };
    });
  }
}
