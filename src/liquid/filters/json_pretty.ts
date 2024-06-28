import { LiquidSwell } from '..';
import { jsonStringifyAsync } from '../utils';

// {{ product | json_pretty }}

export default function bind(_liquidSwell: LiquidSwell) {
  return async (input: any, space = 2) => {
    const output = await jsonStringifyAsync(input, space);
    return `<pre>${output}</pre>`;
  };
}
