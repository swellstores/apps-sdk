import { ShopifyResource, deferWith } from './resource';
import ShopifyProduct from './product';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';

export default function ShopifyRecommendations(
  instance: ShopifyCompatibility,
  product: SwellData,
) {
  if (product instanceof ShopifyResource) {
    return product.clone();
  }

  return new ShopifyResource({
    products: deferWith(product, (product) => {
      return (product?.recommendations || []).map(
        (recommendation: SwellRecord) =>
          ShopifyProduct(instance, recommendation),
      );
    }),
    products_count: deferWith(product, (product: SwellData) => {
      return product?.recommendations?.length || 0;
    }),
    performed: true,
  });
}
