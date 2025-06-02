import { ShopifyResource, deferWith } from './resource';
import ShopifyProduct from './product';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type { ShopifyRecommendations } from 'types/shopify';

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
        (recommendation: SwellRecord) =>
          ShopifyProduct(instance, recommendation),
      );
    }),
    products_count: deferWith(product, (product: SwellData) => {
      return product?.recommendations?.length || 0;
    }),
    'performed?': true,
  });
}
