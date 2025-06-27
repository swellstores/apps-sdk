import type { Swell } from '@/api';
import { SwellStorefrontRecord } from '@/resources';
import type {
  StorefrontResourceGetter,
  SwellData,
  SwellRecord,
} from 'types/swell';
import type { SwellProduct as ISwellProduct } from './swell_types';
import {
  getSelectedVariantOptionValues,
  getPurchaseOptions,
} from './product_helpers';
import { transformSwellVariant } from './variant';

function transformSwellProduct(
  params: SwellData,
  product?: ISwellProduct | null,
) {
  if (!product) {
    return product;
  }

  const newProduct = {
    ...product,

    // add swell properties there
    selected_option_values: getSelectedVariantOptionValues(product, params),
    purchase_options: getPurchaseOptions(product, params),
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

export class SwellProduct<
  T extends SwellData = SwellRecord,
> extends SwellStorefrontRecord<T> {
  public _params: SwellData;
  constructor(
    swell: Swell,
    id: string,
    query: SwellData = {},
    getter?: StorefrontResourceGetter<T>,
  ) {
    super(swell, 'products', id, query, getter);
    // current search parameters
    this._params = swell.queryParams;

    return this._getProxy();
  }

  // add swell properties to the resolved object
  _transformResult(result?: T | null) {
    const res = transformSwellProduct(
      this._params,
      result as unknown as ISwellProduct,
    ) as unknown as T | null | undefined;
    return res;
  }
}
