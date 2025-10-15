import { ShopifyResource, defer, deferWith } from './resource';
import { makeProductsCollectionResolve } from './collection';
import ShopifyProduct from './product';
import ShopifyFilter from './filter';

import { cloneStorefrontResource, StorefrontResource } from '@/resources';
import type { ShopifyCompatibility } from '../shopify';
import type { ShopifySearch } from 'types/shopify';
import type { SwellRecord } from 'types/swell';

export default function ShopifySearch(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
): ShopifyResource<ShopifySearch> {
  if (search instanceof ShopifyResource) {
    return search.clone() as ShopifyResource<ShopifySearch>;
  }

  if (search instanceof StorefrontResource) {
    search = cloneStorefrontResource(search);
  }

  const resolveProducts = makeProductsCollectionResolve(
    instance,
    search,
    (product) => {
      const shopifyProduct = ShopifyProduct(instance, product as SwellRecord);
      (shopifyProduct as any).object_type = 'product';
      return shopifyProduct;
    },
  );

  return new ShopifyResource<ShopifySearch>({
    default_sort_by: deferWith(
      search,
      (search) => search.sort_options?.[0].value,
    ),
    filters: defer(async () => {
      return ((await resolveProducts())?.filter_options ?? []).map((filter) =>
        ShopifyFilter(instance, filter),
      );
    }),
    performed: deferWith(search, (search) => search.performed),
    results: defer(async () => (await resolveProducts())?.results ?? []),
    results_count: defer(async () => (await resolveProducts())?.count || 0),
    sort_by: defer(() => search.sort),
    sort_options: deferWith(search, (search) => search.sort_options),
    terms: defer(() => search.query),
    types: ['product'],
  });
}
