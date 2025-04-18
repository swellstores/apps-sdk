import { stringify, isComparable, isTruthy, resolveEnumerable } from '../utils';

import type { Context } from 'liquidjs';
import type { FilterHandler, FilterImpl } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {% assign specials = collection.products | where: 'special', true %}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function* filterWhere(
    this: FilterImpl,
    arr: unknown,
    property: string,
    expected?: unknown,
  ): IterableIterator<unknown> {
    const results: unknown[] = [];

    const list = yield resolveEnumerable(arr);

    for (const item of list) {
      const value = yield this.context._getFromScope(
        item,
        stringify(property).replace(/\?$/, '').split('.'),
        false,
      );

      if (filterValue(value, expected, this.context)) {
        results.push(item);
      }
    }

    return results;
  };
}

function filterValue(
  value: unknown,
  expected: unknown,
  context: Context,
): boolean {
  if (expected === undefined) return isTruthy(value, context);
  if (isComparable(expected)) return expected.equals(value);
  return value === expected;
}
