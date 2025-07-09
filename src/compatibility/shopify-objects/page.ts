import { ShopifyResource, deferWith } from './resource';

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
    content: deferWith(page, (page) => page.content),
    handle: deferWith(page, (page) => page.slug),
    id: 0,
    metafields: {},
    published_at: deferWith(
      page,
      (page) => page.date_published || page.date_created,
    ),
    template_suffix: deferWith(page, (page) => page.theme_template),
    title: deferWith(page, (page) => page.title || page.name), // Due to deprecated name field
    url: deferWith(page, (page) => `/pages/${page.slug}`),
  });
}
