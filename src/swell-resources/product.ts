import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import {
  ShopifyResource,
  deferWith,
} from '../compatibility/shopify-objects/resource';

import type { ShopifyCompatibility } from '../compatibility/shopify';
import type { SwellRecord } from 'types/swell';

import type { SwellProduct, SwellStorefrontProduct } from 'types/swell_product';
import { getShopifyProductProps } from '../compatibility/shopify-objects/product';
import {
  calculateAddOptionsPrice,
  getSelectedOptionValues,
} from './product_helpers';
import SwellVariant from './variant';

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
  console.log('THIS=', product);
  const shopifyProps = instance.shopifyCompatibilityConfig
    ? getShopifyProductProps(instance, storefrontProduct, SwellVariant, depth)
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
    // add options price
    price: deferWith(product, (product: SwellStorefrontProduct) =>
      calculateAddOptionsPrice(product, instance.swell.queryParams),
    ),
    // prepare selected options
    selected_option_values: deferWith(
      product,
      (product: SwellStorefrontProduct) =>
        getSelectedOptionValues(product, instance.swell.queryParams),
    ),
  };
}
