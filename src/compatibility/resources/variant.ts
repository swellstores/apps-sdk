//@ts-nocheck

import { Swell, SwellStorefrontRecord } from '@/api';
import type { SwellData } from 'types/swell';

export class VariantResource extends SwellStorefrontRecord {
  public product: SwellStorefrontRecord;

  constructor(
    swell: Swell,
    product: SwellStorefrontRecord,
    id: string,
    query: SwellData = {},
  ) {
    super(swell, 'variants', id, query, () =>
      swell.get('/products:variants/{id}', { id }),
    );

    this.product = product;
  }
}
