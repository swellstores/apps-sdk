import { ShopifyResource, defer, deferWith } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData } from 'types/swell';
import type { ShopifyPageObject } from 'types/shopify';

export default function ShopifyPage(
  _instance: ShopifyCompatibility,
  page: SwellData,
): ShopifyResource<ShopifyPageObject> {
  if (page instanceof ShopifyResource) {
    return page.clone() as ShopifyResource<ShopifyPageObject>;
  }

  return new ShopifyResource<ShopifyPageObject>({
    author: undefined, // Not supported
    content: defer(() => page.content),
    handle: defer(() => page.slug),
    id: 0,
    metafields: {},
    published_at: deferWith(
      page,
      (page) => page.date_published || page.date_created,
    ),
    template_suffix: undefined, // TODO
    title: deferWith(page, (page) => page.title || page.name), // Due to deprecated name field
    url: deferWith(page, (page) => `/pages/${page.slug}`),
  });
}
