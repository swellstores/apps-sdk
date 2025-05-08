import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '../..';

// {{ 'option_selection.js' | shopify_asset_url }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterShopifyAssetUrl(input: unknown): unknown {
    if (typeof input === 'string') {
      switch (input) {
        case 'option_selection.js':
          return 'https://cdn.shopify.com/s/shopify/option_selection.js';
        case 'api.jquery.js':
          return 'https://cdn.shopify.com/s/shopify/api.jquery.js';
        case 'shopify_common.js':
          return 'https://cdn.shopify.com/s/shopify/shopify_common.js';
        case 'customer_area.js':
          return 'https://cdn.shopify.com/s/shopify/customer_area.js';
        case 'currencies.js':
          return 'https://cdn.shopify.com/s/javascripts/currencies.js';
        case 'customer.css':
          return 'https://cdn.shopify.com/s/shopify/customer.css';
        default:
          break;
      }
    }

    return input;
  };
}
