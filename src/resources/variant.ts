import type { SwellData } from 'types/swell';
import type { PartialSwellProduct, PartialSwellVariant } from './swell_types';
import {
  calculateAddOptionsVariantPrice,
  getSelectedVariantOptionValues,
} from './product_helpers';

export function transformSwellVariant(
  params: SwellData,
  product: PartialSwellProduct,
  variant: PartialSwellVariant,
) {
  if (!product) {
    return product;
  }

  if (!variant) {
    return variant;
  }

  return {
    ...variant,

    // add swell properties there
    price: calculateAddOptionsVariantPrice(product, variant, params),
    selected_option_values: getSelectedVariantOptionValues(
      product,
      variant,
      params,
    ),
  };
}
