import { ShopifyResource } from './resource';

import type { ThemeFont } from '@/liquid/font';
import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyFont } from 'types/shopify';

export default function ShopifyFont(
  _instance: ShopifyCompatibility,
  font: ThemeFont,
): ShopifyResource<ShopifyFont> {
  if (font instanceof ShopifyResource) {
    return font.clone() as ShopifyResource<ShopifyFont>;
  }

  return new ShopifyResource<ShopifyFont>({
    baseline_ratio: 1, // TODO
    fallback_families: font.fallback_families || 'sans-serif',
    family: font.family,
    style: font.style,
    'system?': font.system,
    variants: font.variants.map((variant) => ShopifyFont(_instance, variant)),
    weight: font.weight,
  });
}
