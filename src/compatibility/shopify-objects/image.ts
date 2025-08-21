import { ShopifyResource, defer, deferWith } from './resource';

import type { StorefrontResource } from '@/resources';
import type { SwellData, SwellRecord } from 'types/swell';
import type { ShopifyImage, ShopifyImageSrc } from 'types/shopify';

interface ShopifyImageOptions {
  media_type?: 'image';
  position?: number;
  product_id?: number;
}

export default function ShopifyImage(
  image: SwellData,
  options: ShopifyImageOptions = {},
  product?: StorefrontResource | SwellRecord,
  variant?: StorefrontResource | SwellRecord, // TODO
): ShopifyResource<ShopifyImage> {
  if (image instanceof ShopifyResource) {
    return image.clone() as ShopifyResource<ShopifyImage>;
  }

  return new ShopifyResource<ShopifyImage>({
    alt: deferWith(image, (image) => image.alt || product?.name),
    aspect_ratio: deferWith(image, (image) =>
      image.width && image.height ? image.width / image.height : 1,
    ),
    'attached_to_variant?': Boolean(variant),
    height: defer(() => image.height),
    id: deferWith(image, (image) => image.file?.id),
    media_type: options.media_type,
    position: options.position ?? undefined,
    // presentation: { focal_point: { x: 0, y: 0 } },
    preview_image: undefined,
    product_id: options.product_id ?? undefined,
    src: deferWith(image, (image) =>
      ShopifyImageSrc(image.file ?? { url: '', width: 0, height: 0 }),
    ),
    variants: undefined, // TODO
    width: defer(() => image.width),
  });
}

function ShopifyImageSrc(file: SwellData): ShopifyResource<ShopifyImageSrc> {
  // TODO: convert to Drop
  return new ShopifyResource<ShopifyImageSrc>(
    {
      url: file.url,
      width: file.width,
      height: file.height,
    },
    'url',
  );
}
