import { Drop } from 'liquidjs';

import type { ShopifyTemplate } from 'types/shopify';

export default class TemplateDrop extends Drop implements ShopifyTemplate {
  constructor(
    public name: ShopifyTemplate['name'],
    public directory?: string,
    public suffix?: string,
  ) {
    super();
  }

  valueOf() {
    return this.name;
  }
}
