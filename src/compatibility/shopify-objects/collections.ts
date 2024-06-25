import { ShopifyCompatibility } from '../shopify';
import { SwellStorefrontCollection } from '../../resources';
import ShopifyCollection from './collection';

export default function ShopifyCollections(
  instance: ShopifyCompatibility,
  categories: SwellStorefrontCollection,
) {
  return new SwellStorefrontCollection(
    instance.swell,
    categories._collection,
    categories._query,
    async () => {
      const results = (await categories.results)?.map((category: any) => {
        return ShopifyCollection(instance, category);
      });

      return {
        page: categories.page,
        count: categories.count,
        results,
        page_count: categories.page_count,
        page_limit: categories.page_limit,
        pages: categories.pages,
      };
    },
  );
}
