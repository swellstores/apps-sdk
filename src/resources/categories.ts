import { SwellStorefrontCollection } from '@/resources';

import type { Swell } from '@/api';
import type { SwellData } from 'types/swell';
import type { SwellCategory, SwellProduct } from './swell_types';

export default class SwellCategories extends SwellStorefrontCollection<SwellCategory> {
  constructor(swell: Swell, query?: SwellData) {
    super(
      swell,
      'categories',
      {
        limit: 100,
        top_id: null,
        ...query,
      },
      async function () {
        const categories = await this._defaultGetter();

        if (!categories) {
          return null;
        }

        for (const category of categories.results) {
          category.products = new SwellStorefrontCollection<SwellProduct>(
            this._swell,
            'products',
            { category: category.id },
          );
        }

        return categories;
      },
    );
  }
}
