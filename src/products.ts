import { Swell, SwellStorefrontCollection, SwellStorefrontRecord } from './api';

import type { SwellData } from '../types/swell';

export function getProducts(
  swell: Swell,
  query?: SwellData,
): SwellStorefrontCollection {
  return new SwellStorefrontCollection(swell, 'products', query);
}

export function getProduct(
  swell: Swell,
  id: string,
  query?: SwellData,
): SwellStorefrontRecord {
  return new SwellStorefrontRecord(swell, 'products', id, query);
}

export function getProductsFiltered(
  swell: Swell,
  {
    search,
    filter,
    sort,
  }: {
    search?: string | null;
    filter?: any;
    sort?: string | null;
  },
): SwellStorefrontCollection {
  return new SwellStorefrontCollection(swell, 'products', {
    search,
    filter,
    sort,
  });
}