import { defaultOperators } from 'liquidjs';

import { isComparable, toValue, isArray, isFunction } from './utils';

import type { Operators } from 'liquidjs';

export const swellOperators: Operators = {
  ...defaultOperators,
  '==': equal,
  '!=': (l: any, r: any) => !equal(l, r),
  contains: (l: any, r: any) => {
    l = toValue(l);
    if (isArray(l)) return l.some((i) => equal(i, r));
    if (isFunction(l?.indexOf)) return l.indexOf(toValue(r)) > -1;
    return false;
  },
};

export function equal(lhs: unknown, rhs: unknown): boolean {
  if (isComparable(lhs)) return lhs.equals(rhs);
  if (isComparable(rhs)) return rhs.equals(lhs);
  lhs = toValue(lhs);
  rhs = toValue(rhs);
  if (isArray(lhs)) {
    return isArray(rhs) && arrayEqual(lhs, rhs);
  }
  // Modified to use `==' instead of `==='
  return lhs == rhs;
}

export function arrayEqual(lhs: unknown[], rhs: unknown[]): boolean {
  if (lhs.length !== rhs.length) return false;
  return !lhs.some((value, i) => !equal(value, rhs[i]));
}
