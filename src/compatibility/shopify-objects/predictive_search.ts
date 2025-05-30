import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';

import type { StorefrontResource } from '@/resources';
import type { ShopifyCompatibility } from '../shopify';
import type { SwellCollection, SwellRecord } from 'types/swell';

export default function ShopifyPredictiveSearch(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
) {
  if (search instanceof ShopifyResource) {
    return search.clone();
  }

  return new ShopifyResource({
    performed: defer(() => search.performed),
    resources: ShopifyPredictiveSearchResources(instance, search),
    terms: defer(() => search.query),
    types: ['product'],
  });
}

function ShopifyPredictiveSearchResources(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
) {
  if (search instanceof ShopifyResource) {
    return search.clone();
  }

  return new ShopifyResource({
    products: deferWith(
      search.products,
      (products: SwellCollection<SwellRecord>) => {
        return products?.results?.map((product) => {
          const shopifyProduct = ShopifyProduct(instance, product) as any;
          shopifyProduct.object_type = 'product';
          return shopifyProduct;
        });
      },
    ),
  });
}
