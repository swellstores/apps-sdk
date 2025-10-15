import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';

import { cloneStorefrontResource, StorefrontResource } from '@/resources';
import type { ShopifyCompatibility } from '../shopify';
import type { SwellCollection, SwellRecord } from 'types/swell';
import type {
  ShopifyPredictiveSearch,
  ShopifyPredictiveSearchResources,
} from 'types/shopify';

export default function ShopifyPredictiveSearch(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
): ShopifyResource<ShopifyPredictiveSearch> {
  if (search instanceof ShopifyResource) {
    return search.clone() as ShopifyResource<ShopifyPredictiveSearch>;
  }

  if (search instanceof StorefrontResource) {
    search = cloneStorefrontResource(search);
  }

  return new ShopifyResource<ShopifyPredictiveSearch>({
    performed: defer(() => search.performed),
    resources: ShopifyPredictiveSearchResources(instance, search),
    terms: defer(() => search.query),
    types: ['product'],
  });
}

function ShopifyPredictiveSearchResources(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
): ShopifyResource<ShopifyPredictiveSearchResources> {
  if (search instanceof ShopifyResource) {
    return search.clone() as ShopifyResource<ShopifyPredictiveSearchResources>;
  }

  return new ShopifyResource<ShopifyPredictiveSearchResources>({
    articles: [],
    collections: [],
    pages: [],
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
