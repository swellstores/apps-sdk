import { jsonStringifyAsync } from '../utils';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ product | json_pretty }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return async function filterJsonPretty(
    input: unknown,
    space: number = 2,
  ): Promise<string> {
    const output = await jsonStringifyAsync(input, space);
    return `<pre>${output}</pre>`;
  };
}
