import { ShopifyResource, deferWith } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type { ShopifyRecommendations } from 'types/shopify';
import SwellProduct from './product_swell';

export default function ShopifyRecommendations(
  instance: ShopifyCompatibility,
  product: SwellData,
): ShopifyResource<ShopifyRecommendations> {
  if (product instanceof ShopifyResource) {
    return product.clone() as ShopifyResource<ShopifyRecommendations>;
  }

  return new ShopifyResource<ShopifyRecommendations>({
    products: deferWith(product, (product) => {
      return (product?.recommendations || []).map(
        (recommendation: SwellRecord) => SwellProduct(instance, recommendation),
      );
    }),
    products_count: deferWith(product, (product: SwellData) => {
      return product?.recommendations?.length || 0;
    }),
    'performed?': true,
  });
}
