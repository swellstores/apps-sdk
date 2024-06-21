import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';

export default function ShopifyImage(
  _instance: ShopifyCompatibility,
  image: SwellData,
  product?: StorefrontResource | SwellRecord,
  variant?: StorefrontResource | SwellRecord, // TODO
) {
  if (image instanceof ShopifyResource) {
    return image.clone();
  }

  return new ShopifyResource({
    alt: deferWith(image, (image: any) => image.alt || product?.name),
    aspect_ratio: 1,
    attached_to_variant: true,
    height: defer(() => image.height),
    id: deferWith(image, (image: any) => image.file?.id),
    media_type: 'image',
    position: null,
    presentation: { focal_point: null }, // x, y
    preview_image: defer(() => image.file),
    product_id: defer(() => product?.id),
    src: deferWith(
      image,
      async (image: any) => image.file && ShopifyImageSrc(image.file),
    ),
    variants: null, // TODO
    width: defer(() => image.width),
  });
}

export function ShopifyImageSrc(file: SwellData) {
  return new ShopifyResource(
    {
      url: file.url,
      width: file.width,
      height: file.height,
    },
    'url',
  );
}
