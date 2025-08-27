import { SwellStorefrontRecord } from '@/resources';

import {
  getSelectedVariantOptionValues,
  getPurchaseOptions,
} from './product_helpers';

import { transformSwellVariant } from './variant';

import type { Swell } from '@/api';
import type { SwellData } from 'types/swell';
import type { SwellProduct as SwellProductType } from './swell_types';

function transformSwellProduct(
  params: SwellData,
  product: SwellProductType | null,
): SwellProductType | null {
  if (!product) {
    return null;
  }

  const newProduct: SwellProductType = {
    ...product,
    // add swell properties there
    selected_option_values: getSelectedVariantOptionValues(product, params),
    purchase_options: getPurchaseOptions(product, params) ?? undefined,
  };

  // transform the variants. we always load variants as part of the product
  // when we apply shopify compatibility to a variant, it will be applied to the modified object with swell properties
  if (Array.isArray(newProduct.variants?.results)) {
    newProduct.variants = {
      ...newProduct.variants,
      results: newProduct.variants.results.map((variant) =>
        transformSwellVariant(params, product, variant),
      ),
    };
  }

  return newProduct;
}

export default class SwellProduct extends SwellStorefrontRecord<SwellProductType> {
  constructor(swell: Swell, id: string, query?: SwellData) {
    // current search parameters
    const params = swell.queryParams;

    super(swell, 'products', id, query, async function () {
      // Instead of this._defaultGetter().call(this), directly call the resource
      const resource = this.getResourceObject();
      const result = await resource.get(this._id, this._query) as SwellProductType | null;

      // add swell properties to the resolved object
      return transformSwellProduct(params, result);
    });

    return this._getProxy();
  }
}
