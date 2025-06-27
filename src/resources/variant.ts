import type { SwellData } from 'types/swell';
import type { SwellProduct, SwellVariant } from './swell_types';
import { getSelectedVariantOptionValues } from './product_helpers';

export function transformSwellVariant(
  params: SwellData,
  product: SwellProduct,
  variant: SwellVariant,
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
    selected_option_values: getSelectedVariantOptionValues(
      product,
      params,
      variant,
    ),
  };
}
