// @ts-nocheck

import { Swell } from '@/api';
import { SwellTheme } from '@/theme';
import forms from './forms';
import resources from './resources';
import { StorefrontShopifyCompatibility } from './shopify-compatibility';

export function initTheme(swell: Swell, options: any) {
  return new SwellTheme(swell, {
    forms,
    resources,
    shopifyCompatibilityClass: StorefrontShopifyCompatibility,
    ...options,
  });
}
