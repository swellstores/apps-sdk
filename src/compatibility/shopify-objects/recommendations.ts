import { ShopifyResource, deferWith } from './resource';
import ShopifyProduct from './product';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData } from 'types/swell';

export default function ShopifyRecommendations(
  instance: ShopifyCompatibility,
  product: SwellData,
) {
  if (product instanceof ShopifyResource) {
    return product.clone();
  }

  return new ShopifyResource({
    products: deferWith(product, (product: any) => {
      return (product?.recommendations || []).map((recommendation: any) =>
        ShopifyProduct(instance, recommendation),
      );
    }),
    products_count: deferWith(product, (product: any) => {
      return product?.recommendations?.length || 0;
    }),
    performed: true,
  });
}
