import { Drop } from 'liquidjs';

import type { ShopifyImageSrc } from 'types/shopify';

export class ImageSrcDrop extends Drop implements ShopifyImageSrc {
  constructor(
    public url: string,
    public width: number,
    public height: number,
  ) {
    super();
  }

  toString() {
    return this.url;
  }

  toJSON() {
    return this.toString();
  }

  toLiquid() {
    return {
      url: this.url,
      width: this.width,
      height: this.height,
    };
  }
}
