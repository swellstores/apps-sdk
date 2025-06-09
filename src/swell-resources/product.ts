import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import {
  ShopifyResource,
  deferWith,
} from '../compatibility/shopify-objects/resource';

import type { ShopifyCompatibility } from '../compatibility/shopify';
import type { SwellRecord } from 'types/swell';

import type {
  SwellShopifyProduct,
  SwellStorefrontProduct,
} from 'types/swell_product';
import { getShopifyProductProps } from '../compatibility/shopify-objects/product';
import {
  calculateAddOptionsPrice,
  getSelectedOptionValues,
} from './product_helpers';
import SwellShopifyVariant from './variant';

export default function SwellShopifyProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
): ShopifyResource<SwellShopifyProduct>;

export default function SwellShopifyProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
  depth: number,
): ShopifyResource<SwellShopifyProduct> | null;

export default function SwellShopifyProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
  depth: number = 0,
): ShopifyResource<SwellShopifyProduct> | null {
  if (product instanceof ShopifyResource) {
    return product.clone() as ShopifyResource<SwellShopifyProduct>;
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
  const shopifyProps = getShopifyProductProps(
    instance,
    storefrontProduct,
    SwellShopifyVariant,
    depth,
  );

  return new ShopifyResource<SwellShopifyProduct>({
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
