import { Operators, defaultOperators } from 'liquidjs';
import { isComparable, toValue, isArray } from './utils';

export const swellOperators: Operators = {
  ...defaultOperators,
  '==': equal,
};

export function equal(lhs: any, rhs: any): boolean {
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

export function arrayEqual(lhs: any[], rhs: any[]): boolean {
  if (lhs.length !== rhs.length) return false;
  return !lhs.some((value, i) => !equal(value, rhs[i]));
}
