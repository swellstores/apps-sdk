import { ShopifyResource, defer, deferWith } from './resource';
import { makeProductsCollectionResolve } from './collection';
import ShopifyFilter from './filter';

import type { StorefrontResource } from '@/resources';
import type { ShopifyCompatibility } from '../shopify';
import type { ShopifySearch } from 'types/shopify';
import type { SwellRecord } from 'types/swell';
import SwellShopifyProduct from '@/compatibility/shopify-objects/product_swell';

export default function ShopifySearch(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
): ShopifyResource<ShopifySearch> {
  if (search instanceof ShopifyResource) {
    return search.clone() as ShopifyResource<ShopifySearch>;
  }

  const resolveProducts = makeProductsCollectionResolve(search, (product) => {
    const shopifyProduct = SwellShopifyProduct(
      instance,
      product as SwellRecord,
    );
    (shopifyProduct as any).object_type = 'product';
    return shopifyProduct;
  });

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
    performed: defer(() => search.performed),
    results: defer(async () => (await resolveProducts())?.results ?? []),
    results_count: defer(async () => (await resolveProducts())?.count || 0),
    sort_by: defer(() => search.sort),
    sort_options: defer(() => search.sort_options),
    terms: defer(() => search.query),
    types: ['product'],
  });
}
