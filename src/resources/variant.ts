import { SwellStorefrontRecord } from '@/resources';
import { getSelectedVariantOptionValues } from './product_helpers';

import type { Swell } from '@/api';
import type {
  SwellProduct,
  SwellVariant as SwellVariantType,
} from './swell_types';
import type { SwellData } from 'types/swell';

export function transformSwellVariant(
  params: SwellData,
  product: SwellProduct,
  variant: SwellVariantType,
): SwellVariantType {
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

export default class SwellVariant extends SwellStorefrontRecord<SwellVariantType> {
  public product: SwellStorefrontRecord<SwellProduct>;

  constructor(
    swell: Swell,
    product: SwellStorefrontRecord<SwellProduct>,
    id: string,
    query?: SwellData,
  ) {
    // current search parameters
    const params = swell.queryParams;

    super(swell, 'products:variants', id, query, async function () {
      const variant = await this._swell.get<SwellVariantType>(
        '/products:variants/:last',
        { $or: [{ id: this._id }, { sku: this._id }] },
      );

      // add swell properties to the resolved object
      return transformSwellVariant(
        params,
        product instanceof SwellStorefrontRecord
          ? ((await product.resolve()) as SwellProduct)
          : product,
        variant as SwellVariantType,
      );
    });

    this.product = product;
  }
}
