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

export const SORT_OPTIONS = [
  { value: '', name: 'Featured' },
  { value: 'popularity', name: 'Popularity', query: 'popularity desc' },
  { value: 'price_asc', name: 'Price, low to high', query: 'price asc' },
  { value: 'price_desc', name: 'Price, high to low', query: 'price desc' },
  { value: 'date_asc', name: 'Date, old to new', query: 'date asc' },
  { value: 'date_desc', name: 'Date, new to old', query: 'date desc' },
  { value: 'name_asc', name: 'Product name, A-Z', query: 'name asc' },
  { value: 'name_desc', name: 'Product name, Z-A', query: 'name desc' },
];

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

export function productQueryWithFilters(swell: Swell, query: SwellData = {}) {
  const sortBy = swell.queryParams.sort || '';
  const filters = Object.entries(swell.queryParams).reduce(
    (acc: any, [key, value]: any) => {
      if (key.startsWith('filter_')) {
        const qkey = key.replace('filter_', '');
        if (value?.gte !== undefined || value?.lte !== undefined) {
          acc[qkey] = [value.gte || 0, value.lte || undefined];
        } else {
          acc[qkey] = value;
        }
      }
      return acc;
    },
    {},
  );

  return {
    sort:
      SORT_OPTIONS.find((option) => option.value === sortBy)?.query ||
      undefined,
    $filters: filters,
    ...query,
  };
}
