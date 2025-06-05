import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import { ShopifyResource, deferWith } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';

import type { SwellProduct, SwellStorefrontProduct } from 'types/swell_product';
import { getShopifyProductProps } from './product';
import {
  calculateAddOptionsPrice,
  getSelectedOptionValues,
} from './product_functions';

export default function SwellProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
): ShopifyResource<SwellProduct>;

export default function SwellProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
  depth: number,
): ShopifyResource<SwellProduct> | null;

export default function SwellProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
  depth: number = 0,
): ShopifyResource<SwellProduct> | null {
  if (product instanceof ShopifyResource) {
    return product.clone() as ShopifyResource<SwellProduct>;
  }

  if (product instanceof StorefrontResource) {
    product = cloneStorefrontResource(product);
  }

  // TODO: find a better way to prevent infinite loop
  if (depth > 1) {
    return null;
  }

  const storefrontProduct = product as unknown as SwellStorefrontProduct;
  const shopifyProps = instance.shopifyCompatibilityConfig
    ? getShopifyProductProps(instance, storefrontProduct, depth)
    : {};

  // @ts-expect-error TODO
  return new ShopifyResource<SwellProduct>({
    // raw swell properties
    ...storefrontProduct,
    // shopify properties
    ...shopifyProps,
    // swell specific properties
    ...getSwellProductProps(instance, storefrontProduct),
  });
}

function getSwellProductProps(
  instance: ShopifyCompatibility,
  product: SwellStorefrontProduct,
) {
  return {
    price: deferWith(product, (product: SwellStorefrontProduct) =>
      calculateAddOptionsPrice(product, instance.swell.queryParams),
    ),
    selected_option_values: deferWith(
      product,
      (product: SwellStorefrontProduct) =>
        getSelectedOptionValues(product, instance.swell.queryParams),
    ),
  };
}
