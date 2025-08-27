import { SwellStorefrontRecord } from '@/resources';

import { getProductFilters } from './product_helpers';

import type { Swell } from '@/api';
import type { SwellData } from 'types/swell';
import type { SwellCategory as SwellCategoryType } from './swell_types';

export default class SwellCategory extends SwellStorefrontRecord<SwellCategoryType> {
  constructor(swell: Swell, id: string, query?: SwellData) {
    super(swell, 'categories', id, query, async function () {
      let category = await this._defaultGetter();

      if (!category && this._id === 'all') {
        category = {
          name: 'Products',
          id: 'all',
          slug: 'all',
          filter_options: [],
          sort_options: [],
        };
      }

      if (!category) {
        return null; // Not found
      }

      const productFilters = await getProductFilters(
        this._swell,
        category.id !== 'all'
          ? { category: category.id, $variants: true }
          : { $variants: true },
      );

      Object.assign(category, productFilters);

      return category;
    });

    return this._getProxy();
  }
}
