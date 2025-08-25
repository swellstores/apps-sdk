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
    super(swell, 'products:variants', id, query, async function () {
      const variant = await this._swell.get<SwellVariantType>(
        '/products:variants/{id}',
        { id: this._id },
      );

      return variant ?? null;
    });

    this.product = product;
  }
}
