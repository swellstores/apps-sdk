import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';
import ShopifyFilter from './filter';

import type { StorefrontResource } from '@/resources';
import type { ShopifyCompatibility } from '../shopify';

export default function ShopifySearch(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
) {
  if (search instanceof ShopifyResource) {
    return search.clone();
  }

  const productResults = deferWith(search, (search) => {
    return (
      search.products?._cloneWithCompatibilityResult((products: any) => {
        return {
          results: products?.results?.map((product: any) => {
            const shopifyProduct = ShopifyProduct(instance, product) as any;
            shopifyProduct.object_type = 'product';
            return shopifyProduct;
          }),
        };
      }) || []
    );
  });

  return new ShopifyResource({
    default_sort_by: deferWith(
      search,
      (search) => search.sort_options?.[0].value,
    ),
    filters: defer(async () => {
      const products = await productResults.resolve();
      return (
        (await products?.filter_options)?.map((filter: any) =>
          ShopifyFilter(instance, filter),
        ) || []
      );
    }),
    performed: defer(() => search.performed),
    results: productResults,
    results_count: defer(
      async () => (await productResults.resolve())?.count || 0,
    ),
    sort_by: defer(() => search.sort),
    sort_options: defer(() => search.sort_options),
    terms: defer(() => search.query),
    types: ['product'],
  });
}
