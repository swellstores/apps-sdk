import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import { ShopifyResource, deferWith } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';

import type {
  SwellShopifyVariant,
  SwellStorefrontProduct,
  SwellStorefrontVariant,
} from 'types/swell_product';
import {
  getSelectedVariantOptionValues,
  getVariantPrice,
} from '../../swell-resources/product_helpers';
import { getShopifyVariantProps } from './variant';
import SwellShopifyProduct from './product_swell';

export default function SwellShopifyVariant(
  instance: ShopifyCompatibility,
  variant: StorefrontResource | SwellRecord,
  productIn?: StorefrontResource | SwellRecord,
  depth: number = 0,
): ShopifyResource<SwellShopifyVariant> {
  if (variant instanceof ShopifyResource) {
    return variant.clone() as ShopifyResource<SwellShopifyVariant>;
  }

  if (variant instanceof StorefrontResource) {
    variant = cloneStorefrontResource(variant);
  }

  const product = productIn || variant.product || {};

  const storefrontProduct = product as unknown as SwellStorefrontProduct;
  const storefrontVariant = variant as unknown as SwellStorefrontVariant;
  const shopifyProps = getShopifyVariantProps(
    instance,
    storefrontVariant,
    storefrontProduct,
    SwellShopifyProduct,
    depth,
  );

  return new ShopifyResource<SwellShopifyVariant>({
    // raw swell properties
    ...storefrontVariant,
    // shopify properties
    ...shopifyProps,
    // swell specific properties
    ...getSwellVariantProps(instance, storefrontVariant, storefrontProduct),
  });
}

function getSwellVariantProps(
  instance: ShopifyCompatibility,
  variant: SwellStorefrontVariant,
  product: SwellStorefrontProduct,
) {
  return {
    // add options price
    price: deferWith(
      [product, variant],
      (product: SwellStorefrontProduct, variant) =>
        getVariantPrice(
          product,
          variant as unknown as SwellStorefrontVariant,
          instance.swell.queryParams,
        ),
    ),
    // prepare selected options
    selected_option_values: deferWith(
      [product, variant],
      (product: SwellStorefrontProduct, variant) =>
        getSelectedVariantOptionValues(
          product,
          variant as unknown as SwellStorefrontVariant,
          instance.swell.queryParams,
        ),
    ),
  };
}
