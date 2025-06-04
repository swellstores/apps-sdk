import { StorefrontResource } from '@/resources';

import { ShopifyResource, deferWith } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';
import type { ShopifyProduct } from 'types/shopify';
import {
  calculateAddOptionsPrice,
  getSelectedOptionValues,
} from './product_functions';

export default function SwellProduct(
  props: any,
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyProduct> {
  return {
    ...props,

    // Recalculate swell options
     price: deferWith(product, (product) =>
      calculateAddOptionsPrice(product, instance.swell.queryParams),
    ),

    // Add swell options
    // all options values including non-variant
    selected_option_values: deferWith(product, (product) =>
      getSelectedOptionValues(product, instance.swell.queryParams),
    ),

    // another solution is to add swell options to metafields
    metafields: deferWith(product, (product) => {
      return {
        swell: {
          selected_option_values: getSelectedOptionValues(
            product,
            instance.swell.queryParams,
          ),
        },
      };
    }),
  };
}
