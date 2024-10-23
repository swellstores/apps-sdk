import { Context } from 'liquidjs';
import { StorefrontResource } from '../resources';

export const toString = Object.prototype.toString;
export const hasOwnProperty = Object.hasOwnProperty;

/**
 * Utils used by liquidjs tags and filters
 */
export class Drop {
  liquidMethodMissing(key: string) {
    return undefined;
  }
}

// Note: has to refactor this to use class props instead of methods for some reason
// The class methods weren't working in our implementation
export class ForloopDrop extends Drop {
  public i: number;
  public length: number;
  public name: string;
  public test: string = 'test';
  public index: number;
  public index0: number;
  public first: boolean;
  public last: boolean;
  public rindex: number;
  public rindex0: number;

  constructor(length: number, collection: string, variable: string) {
    super();
    this.length = length;
    this.name = `${variable}-${collection}`;
    this.i = 0;
    this.index = 1;
    this.index0 = 0;
    this.first = true;
    this.last = false;
    this.rindex = length;
    this.rindex0 = length - 1;
  }

  next() {
    this.i++;
    this.index++;
    this.index0++;
    this.first = false;
    this.last = this.i === this.length - 1;
    this.rindex--;
    this.rindex0--;
  }

  valueOf() {
    return JSON.stringify(this);
  }
}

export function toValue(value: any) {
  return value instanceof Drop && isFunction(value.valueOf)
    ? value.valueOf()
    : value;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function toLiquid(value: unknown) {
  if (isObject(value) && isFunction(value.toLiquid))
    return toLiquid(value.toLiquid());
  return value;
}

export function isNil(value: unknown): value is undefined | null {
  return value == null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isArray<T>(value: unknown): value is Array<T> {
  // be compatible with IE 8
  return toString.call(value) === '[object Array]';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  const type = typeof value;
  return value !== null && (type === 'object' || type === 'function');
}

export function isIterable<T>(value: unknown): value is Iterable<T> {
  return isObject(value) && Symbol.iterator in value;
}

export function isLikePromise(value: unknown): value is PromiseLike<unknown> {
  return isObject(value) && typeof value.then === 'function';
}

export function isTruthy(val: any, ctx: Context): boolean {
  return !isFalsy(val, ctx);
}

export function isFalsy(val: any, ctx: Context): boolean {
  if (ctx.opts.jsTruthy) {
    return !val;
  } else {
    return val === false || undefined === val || val === null;
  }
}

export interface Comparable {
  equals(rhs: unknown): boolean;
  gt(rhs: unknown): boolean;
  geq(rhs: unknown): boolean;
  lt(rhs: unknown): boolean;
  leq(rhs: unknown): boolean;
}

export function isComparable(arg: unknown): arg is Comparable {
  return isObject(arg) && isFunction(arg.equals);
}

export function toArray<T>(val: unknown): T[] {
  if (isNil(val)) return [];
  if (isArray<T>(val)) return val;
  return [val as T];
}

export function toEnumerable<T>(val: unknown): T[] {
  val = toValue(val);
  if (isArray<T>(val)) return val;
  if (isString(val) && val.length > 0) return [val as T];
  if (isIterable<T>(val)) return Array.from(val);
  if (isObject(val))
    // Converting keyed objects to an array with id is required for Shopify compatibility
    return Object.entries(val).reduce<T[]>((acc, [key, value]) => {
      acc.push({ id: key, ...(value as T) });
      return acc;
    }, []); //map((key) => [key, val[key]]);
  return [];
}

export function stringify(value: unknown): string {
  value = toValue(value);
  if (isString(value)) return value;
  if (isNil(value)) return '';
  if (isArray(value)) return value.map((x) => stringify(x)).join('');
  return String(value);
}

export function paramsToProps(
  params: string[] | Record<string, string>,
): Record<string, unknown> {
  // Convert array formatted params to props object
  if (Array.isArray(params)) {
    return params.reduce((acc: Record<string, unknown>, param, index) => {
      if (index % 2 === 0) {
        acc[param] = params[index + 1];
      }
      return acc;
    }, {});
  } else if (isObject(params)) {
    // Convert object formatted params with number indexes to props object
    const props: Record<string, unknown> = {};
    const values = Object.values(params);
    for (let i = 0; i < values.length; i += 2) {
      props[values[i]] = values[i + 1];
    }
    return props;
  }
  return {};
}

export async function jsonStringifyAsync(
  input: unknown,
  space = 0,
): Promise<string> {
  let value = input;

  if (value instanceof StorefrontResource) {
    value = await value.resolve();
  }

  await resolveAllKeys(value);

  // Catch circular references, for example StorefrontResource
  const references: any[] = [];

  return JSON.stringify(
    value,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (references.includes(value)) {
          // Ignore circular reference
          return;
        }
        references.push(value);
      }
      return value;
    },
    space,
  );
}

async function resolveAllKeys(
  value: unknown,
  references: WeakSet<object> = new WeakSet(),
) {
  await forEachKeyDeep(value as Record<string, unknown>, async (key, value) => {
    if (!isObject(value)) {
      return;
    }
    const val = value[key];
    if (isLikePromise(val)) {
      value[key] = await val;
      await resolveAllKeys(value[key], references);
    } else if (typeof val === 'object' && val !== null) {
      if (references.has(val)) {
        // Ignore circular reference
        return false;
      }
      references.add(val);
    }
  });
}

async function forEachKeyDeep(
  obj: Record<string, unknown>,
  fn: (key: string, value: Record<string, unknown>) => Promise<unknown>,
) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = await fn(key, obj);
      if (result !== false) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          await forEachKeyDeep(value as Record<string, unknown>, fn);
        }
      }
    }
  }
}
