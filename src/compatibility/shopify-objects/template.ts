import { ShopifyResource } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData } from 'types/swell';

export default function ShopifyTemplate(
  _instance: ShopifyCompatibility,
  template: SwellData,
) {
  return new ShopifyResource(
    {
      directory: template.path,
      name: template.name,
      suffix: template.alt_name,
    },
    'name',
  );
}
