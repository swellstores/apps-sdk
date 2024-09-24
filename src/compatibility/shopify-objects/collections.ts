import { SwellStorefrontCollection } from '../../resources';
import { ShopifyCompatibility } from '../shopify';
import ShopifyCollection from './collection';

import type { SwellCollection, InferSwellCollection, SwellRecord } from 'types/swell';

export default function ShopifyCollections<T extends SwellCollection = SwellCollection>(
  instance: ShopifyCompatibility,
  categories: SwellStorefrontCollection<T>,
) {
  return new SwellStorefrontCollection(
    instance.swell,
    categories._collection,
    categories._query,
    async () => {
      const results = (await categories.results)?.map((category) => {
        return ShopifyCollection(instance, category);
      });

      return {
        page: categories.page ?? 1,
        count: categories.count ?? 0,
        results: results as InferSwellCollection<T>[],
        page_count: categories.page_count ?? 0,
        limit: categories.limit,
        pages: categories.pages ?? {},
      };
    },
  );
}
