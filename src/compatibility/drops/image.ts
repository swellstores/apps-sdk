import { Drop } from 'liquidjs';

import { ImageSrcDrop } from './image-src';

import type { StorefrontResource } from '@/resources';
import type { SwellData, SwellRecord } from 'types/swell';
import type {
  ShopifyImage,
  ShopifyImagePresentation,
  ShopifyImageSrc,
  ShopifyVariant,
} from 'types/shopify';

interface ShopifyImageOptions {
  media_type?: 'image';
  position?: number;
  product_id?: number;
}

export class ImageDrop extends Drop implements ShopifyImage {
  public id: number;
  public alt: string;
  public src: ShopifyImageSrc;
  public media_type?: 'image' | undefined;
  public preview_image?: ShopifyImage | undefined;
  public presentation?: ShopifyImagePresentation | undefined;
  public aspect_ratio: number;
  public 'attached_to_variant?': boolean | undefined;
  public width: number;
  public height: number;
  public position?: number | undefined;
  public product_id?: number | undefined;
  public variants?: ShopifyVariant[] | undefined;

  constructor(
    image: SwellData,
    options: ShopifyImageOptions = {},
    product?: StorefrontResource | SwellRecord,
    variant?: StorefrontResource | SwellRecord, // TODO
  ) {
    super();

    const file = image.file ?? { url: '', width: 0, height: 0 };

    this.id = file.id;
    this.alt = image.alt || product?.name;
    this.src = new ImageSrcDrop(file.url, file.width, file.height);
    this.media_type = options.media_type;
    this.preview_image = undefined; // TODO
    this.presentation = undefined; // TODO
    this.aspect_ratio =
      image.width && image.height ? image.width / image.height : 1;
    this.width = image.width;
    this.height = image.height;
    this['attached_to_variant?'] = Boolean(variant);
    this.position = options.position ?? undefined;
    this.product_id = options.product_id ?? undefined;
    this.variants = undefined; // TODO
  }

  toString() {
    return this.src.toString();
  }

  [Symbol.toPrimitive]() {
    return this.toString();
  }

  toJSON() {
    return this.toString();
  }
}
