import { jsonStringifyAsync } from '../utils';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product | json }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return async function filterJson(
    input: unknown,
    space: number = 0,
  ): Promise<string> {
    return jsonStringifyAsync(input, space);
  };
}
