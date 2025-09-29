import TemplateDrop from '../drops/template';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData } from 'types/swell';
import type { ShopifyTemplate } from 'types/shopify';

export default function ShopifyTemplate(
  instance: ShopifyCompatibility,
  template: SwellData,
): ShopifyTemplate {
  return new TemplateDrop(
    instance.getPageType(template.name) as ShopifyTemplate['name'],
    template.path,
    template.alt_name,
  );
}
