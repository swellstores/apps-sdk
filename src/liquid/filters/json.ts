import { LiquidSwell } from '..';
import { jsonStringifyAsync } from '../utils';

// {{ product | json }}

export default function bind(_liquidSwell: LiquidSwell) {
  return async (input: unknown, space = 0) => {
    return jsonStringifyAsync(input, space);
  };
}
