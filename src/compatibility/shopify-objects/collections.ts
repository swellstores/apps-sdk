import { SwellStorefrontCollection } from '@/resources';
import ShopifyCollection from './collection';

import type { ShopifyResource } from './resource';
import type { ShopifyCompatibility } from '../shopify';
import type { SwellCollection } from 'types/swell';
import type { ShopifyCollection as ShopifyCollectionType } from 'types/shopify';

export default function ShopifyCollections<
  T extends SwellCollection = SwellCollection,
>(instance: ShopifyCompatibility, categories: SwellStorefrontCollection<T>) {
  return new SwellStorefrontCollection<
    SwellCollection<ShopifyResource<ShopifyCollectionType>>
  >(instance.swell, categories._collection, categories._query, async () => {
    const results = (await categories.results)?.map((category) => {
      return ShopifyCollection(instance, category);
    });

    return {
      page: categories.page ?? 1,
      count: categories.count ?? 0,
      results: results ?? [],
      page_count: categories.page_count ?? 0,
      limit: categories.limit,
      pages: categories.pages ?? {},
    };
  });
}
