import { kebabCase } from 'lodash-es';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product.title | handleize }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterHandleize(handle: string): string {
    return kebabCase(handle);
  };
}
