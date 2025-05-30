import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource } from './resource';
import ShopifyImage from './image';

import type { SwellData } from 'types/swell';
import type { ShopifyMedia } from 'types/shopify';

interface ShopifyMediaOptions {
  media_type?: ShopifyMedia['media_type'];
  position?: ShopifyMedia['position'];
}

export default function ShopifyMedia(
  instance: ShopifyCompatibility,
  image: SwellData,
  options?: ShopifyMediaOptions,
): ShopifyResource<ShopifyMedia> {
  if (image instanceof ShopifyResource) {
    return image.clone() as ShopifyResource<ShopifyMedia>;
  }

  return new ShopifyResource<ShopifyMedia>({
    alt: image.alt,
    id: image.id || image.file?.id,
    media_type: options?.media_type ?? 'image',
    position: options?.position,
    preview_image: ShopifyImage(instance, image),
  });
}
