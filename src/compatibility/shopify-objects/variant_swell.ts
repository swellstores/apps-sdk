import { StorefrontResource } from '@/resources';

import { ShopifyResource, deferWith } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';
import type { ShopifyVariant } from 'types/shopify';
import {
  getSelectedOptionValues,
  getSelectedVariantOptionValues,
  getVariantPrice,
} from './product_functions';

export default function SwellVariant(
  props: any,
  instance: ShopifyCompatibility,
  variant: StorefrontResource | SwellRecord,
  productIn?: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyVariant> {
  const product = productIn || variant.product || {};
  return {
    ...props,

    // Recalculate swell options
    price: deferWith([product, variant], (product, variant) =>
      getVariantPrice(product, variant, instance.swell.queryParams),
    ),

    // Add swell options
    selected_option_values: deferWith([product, variant], (product, variant) =>
      getSelectedVariantOptionValues(
        product,
        variant,
        instance.swell.queryParams,
      ),
    ),

    // another solution is to add swell options to metafields
    metafields: deferWith([product, variant], (product, variant) => {
      return {
        swell: {
          selected_option_values: getSelectedVariantOptionValues(
            product,
            variant,
            instance.swell.queryParams,
          ),
        },
      };
    }),
  };
}
