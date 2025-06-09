import type { Swell } from '@/api';
import { StorefrontResource } from '@/resources';
import type { SwellData, SwellRecord } from 'types/swell';
import type {
  SwellStorefrontProduct,
  SwellStorefrontVariant,
} from 'types/swell_product';
import {
  calculateAddOptionsPrice,
  getSelectedOptionValues,
  getSelectedVariantOptionValues,
  getVariantPrice,
} from './product_helpers';

function transformSwellVariant(
  params: SwellData,
  product: SwellStorefrontProduct,
  variant: SwellStorefrontVariant,
) {
  if (!product) {
    return product;
  }

  variant.price = getVariantPrice(product, variant, params);
  variant.selected_option_values = getSelectedVariantOptionValues(
    product,
    variant,
    params,
  );

  return variant;
}

export function transformSwellProduct(
  params: SwellData,
  product?: SwellStorefrontProduct | null,
) {
  if (!product) {
    return product;
  }

  product.price = calculateAddOptionsPrice(product, params);
  product.selected_option_values = getSelectedOptionValues(product, params);

  if (Array.isArray(product.variants?.results)) {
    product.variants.results.forEach((variant) =>
      transformSwellVariant(params, product, variant),
    );
  }

  return product;
}

export default function SwellProduct(
  swell: Swell,
  product: StorefrontResource | SwellRecord,
) {
  if (!product) {
    return product;
  }

  const storefrontProduct = product as unknown as SwellStorefrontProduct;

  const swellProduct = {
    // raw swell properties
    ...storefrontProduct,
  };

  // swell specific properties
  return transformSwellProduct(swell.queryParams, swellProduct);
}
