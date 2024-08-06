import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource } from './resource';

import type { SwellData } from 'types/swell';

export default function ShopifyMedia(
  _instance: ShopifyCompatibility,
  image: SwellData,
) {
  if (image instanceof ShopifyResource) {
    return image.clone();
  }

  return new ShopifyResource({
    alt: image.alt,
    id: image.id || image.file?.id,
    media_type: 'image',
    position: null,
    preview_image: image.file,
  });
}
