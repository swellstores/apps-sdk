import { snakeCase } from 'lodash-es';

import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource } from './resource';

import type { SwellMenu, SwellMenuItem } from 'types/swell';

export default function ShopifyLink(
  instance: ShopifyCompatibility,
  parent: SwellMenu | SwellMenuItem,
  menuItem: SwellMenuItem,
): ShopifyResource {
  const parentHandle = (parent as any).handle || (parent as any).id;

  return new ShopifyResource({
    active: menuItem.active,
    child_active: menuItem.child_active,
    child_current: menuItem.child_current,
    current: menuItem.current,
    handle: `${parentHandle}-${snakeCase(menuItem.name)}`,
    levels: menuItem.levels,
    links: menuItem.items?.map((item) => ShopifyLink(instance, menuItem, item)),
    object: menuItem.resource,
    title: menuItem.name,
    type: getLinkType(menuItem.type),
    url: menuItem.url,
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
      return '';
  }
}
