import { Swell, SwellStorefrontRecord } from '@/api';
import type { SwellData } from 'types/swell';

export class PageResource extends SwellStorefrontRecord {
  constructor(swell: Swell, slug: string, query: SwellData = {}) {
    super(swell, 'content/pages', slug, query);
  }
}
