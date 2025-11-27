import { Drop } from 'liquidjs';
import type { SwellRecord } from 'types/swell';
import { StorefrontResource } from '@/resources';

/* 
  Combines product content and description
  Use {{ product.content }} to render the description
  Use {{ product.content.content_field }} to render the content field
*/
export class ShopifySwellContent extends Drop {
  public content: Record<string, string>;
  public description: string;
  constructor(product?: StorefrontResource | SwellRecord) {
    super();
    this.content = (product?.content as Record<string, string>) || {};
    this.description = (product?.description as string) || '';
  }

  toString() {
    return this.description;
  }

  toObject() {
    const combined = Object.assign({}, this.content);

    return combined;
  }

  toJSON() {
    return this.toObject();
  }

  toLiquid() {
    return this.toObject();
  }
}
