import { snakeCase } from 'lodash-es';

import { ShopifyResource } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellMenu, SwellMenuItem } from 'types/swell';
import type { ShopifyLink } from 'types/shopify';

export default function ShopifyLink(
  instance: ShopifyCompatibility,
  parent: SwellMenu | SwellMenuItem,
  menuItem: SwellMenuItem,
): ShopifyResource<ShopifyLink> {
  const parentHandle = (parent as any).handle || (parent as any).id;

  return new ShopifyResource<ShopifyLink>({
    active: Boolean(menuItem.active),
    child_active: Boolean(menuItem.child_active),
    child_current: Boolean(menuItem.child_current),
    current: Boolean(menuItem.current),
    handle: `${parentHandle}-${snakeCase(menuItem.name)}`,
    levels: menuItem.levels,
    links: menuItem.items?.map((item) => ShopifyLink(instance, menuItem, item)),
    object: menuItem.resource,
    title: menuItem.name,
    type: getLinkType(menuItem.type),
    url: String(menuItem.url),
  });
}

function getLinkType(type: string) {
  switch (type) {
    case 'home':
      return 'frontpage_link';
    case 'category':
      return 'collection_link';
    case 'product':
      return 'product_link';
    case 'search':
      return 'search_link';
    default:
      return 'page_link';
  }
}
