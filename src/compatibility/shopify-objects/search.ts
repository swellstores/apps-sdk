import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource, SwellStorefrontCollection } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';
import ShopifyFilter from './filter';

export default function ShopifySearch(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
) {
  if (search instanceof ShopifyResource) {
    return search.clone();
  }

  return new ShopifyResource({
    default_sort_by: deferWith(
      search,
      (search: any) => search.sort_options?.[0].value,
    ),
    filters: deferWith(
      search,
      async (search: any) =>
        (await search.products.filter_options)?.map((filter: any) =>
          ShopifyFilter(instance, filter),
        ) || [],
    ),
    performed: defer(() => search.performed),
    results: deferWith(search, () => {
      return search.products._cloneWithCompatibilityResult((products: any) => {
        return {
          results: products?.results?.map((product: any) => {
            const shopifyProduct = ShopifyProduct(instance, product) as any;
            shopifyProduct.object_type = 'product';
            return shopifyProduct;
          }),
        };
      });
    }),
    results_count: deferWith(
      search,
      async (search: any) => (await search.products)?.count || 0,
    ),
    sort_by: defer(() => search.sort),
    sort_options: defer(() => search.sort_options),
    terms: defer(() => search.query),
    types: ['product'],
  });
}
