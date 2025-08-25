import { StorefrontResource, SwellStorefrontCollection } from '@/resources';

import type { Swell } from '@/api';
import type {
  SwellPredictiveSearch as SwellPredictiveSearchType,
  SwellProduct,
} from './swell_types';

export default class SwellPredictiveSearch extends StorefrontResource<SwellPredictiveSearchType> {
  constructor(swell: Swell, query?: string) {
    super(async function () {
      const performed = String(query || '').length > 0;

      let products;
      if (performed) {
        products = new SwellStorefrontCollection<SwellProduct>(
          swell,
          'products',
          {
            search: query,
            limit: 10,
          },
        );

        await products.resolve();
      }

      return {
        query,
        performed,
        products,
      };
    });
  }
}
