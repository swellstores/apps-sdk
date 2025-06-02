import { ShopifyResource } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData } from 'types/swell';
import type { ShopifyTemplate } from 'types/shopify';

export default function ShopifyTemplate(
  _instance: ShopifyCompatibility,
  template: SwellData,
): ShopifyResource<ShopifyTemplate> {
  return new ShopifyResource<ShopifyTemplate>(
    {
      directory: template.path,
      name: template.name,
      suffix: template.alt_name,
    },
    'name',
  );
}
