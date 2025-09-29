import { ImageDrop } from '../drops/image';

import type { StorefrontResource } from '@/resources';
import type { SwellData, SwellRecord } from 'types/swell';
import type { ShopifyImage } from 'types/shopify';

interface ShopifyImageOptions {
  media_type?: 'image';
  position?: number;
  product_id?: number;
}

export default function ShopifyImage(
  image: SwellData,
  options: ShopifyImageOptions = {},
  product?: StorefrontResource | SwellRecord,
  variant?: StorefrontResource | SwellRecord,
): ShopifyImage {
  return new ImageDrop(image, options, product, variant);
}
