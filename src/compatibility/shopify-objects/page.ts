import { ShopifyCompatibility } from '../shopify';
import { ShopifyResource, defer, deferWith } from './resource';

export default function ShopifyPage(
  _instance: ShopifyCompatibility,
  page: SwellData,
) {
  if (page instanceof ShopifyResource) {
    return page.clone();
  }
  return new ShopifyResource({
    content: deferWith(page, (page: any) => page.content),
    handle: defer(() => page.slug),
    metafields: null,
    published_at: defer(
      async () => (await page.date_published) || page.date_created,
    ),
    template_suffix: null, // TODO
    title: deferWith(page, (page: any) => page.title || page.name), // Due to deprecated name field
    url: deferWith(page, (page: any) => `/pages/${page.slug}`),

    // Not supported
    author: null,
  });
}
