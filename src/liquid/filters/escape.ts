import { escape } from 'lodash-es';
import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ 'text' | escape }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function escapeTag(input: string): string {
    if (!input?.startsWith) {
      return input;
    }

    // in Shopify img and video are not escaped
    if (input.startsWith('<img') || input.startsWith('<video')) {
      return input;
    }

    return escape(input);
  };
}
