import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';

export default function ShopifyPredictiveSearch(
  instance: ShopifyCompatibility,
  search: StorefrontResource,
) {
  if (search instanceof ShopifyResource) {
    return search.clone();
  }

  return new ShopifyResource({
    performed: deferWith(search, (search: any) => search.performed),
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
    products: deferWith(search.products, (products: any) => {
      return products?.results?.map((product: any) => {
        const shopifyProduct = ShopifyProduct(instance, product) as any;
        shopifyProduct.object_type = 'product';
        return shopifyProduct;
      });
    }),
  });
}
