import { Context, Drop } from 'liquidjs';

import { StorefrontResource, SwellStorefrontCollection } from '../resources';
import { DeferredShopifyResource } from '@/compatibility/shopify-objects/resource';

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
  public parentloop: ForloopDrop | null;

  constructor(
    length: number,
    collection: string,
    variable: string,
    parent?: ForloopDrop,
  ) {
    super();

    this.length = length;
    this.name = `${variable}-${collection}`;
    this.i = 0;
    this.index = 1;
    this.index0 = 0;
    this.first = true;
    this.last = length <= 0;
    this.rindex = length;
    this.rindex0 = length - 1;
    this.parentloop = parent ?? null;
  }

  next(): void {
    this.i += 1;
    this.index += 1;
    this.index0 += 1;
    this.first = false;
    this.last = this.i === this.length - 1;
    this.rindex -= 1;
    this.rindex0 -= 1;
  }

  valueOf(): string {
    return JSON.stringify(this);
  }
}

export function toValue(value: unknown) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
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

export function isFunction(
  value: unknown,
): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function toLiquid(value: unknown) {
  if (isObject(value) && isFunction(value.toLiquid)) {
    return toLiquid(value.toLiquid());
  }

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
  return Object.prototype.toString.call(value) === '[object Array]';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  switch (typeof value) {
    case 'object':
    case 'function':
      return value !== null;

    default:
      return false;
  }
}

export function isIterable<T>(value: unknown): value is Iterable<T> {
  return isObject(value) && Symbol.iterator in value;
}

export function isLikePromise(value: unknown): value is Promise<unknown> {
  return isObject(value) && typeof value.then === 'function';
}

export function isTruthy(val: unknown, ctx: Context): boolean {
  return !isFalsy(val, ctx);
}

export function isFalsy(val: unknown, ctx: Context): boolean {
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
  if (isObject(val)) {
    // Converting keyed objects to an array with id is required for Shopify compatibility
    return Object.entries(val).reduce<T[]>((acc, [key, value]) => {
      acc.push({ id: key, ...(value as T) });
      return acc;
    }, []); //map((key) => [key, val[key]]);
  }
  return [];
}

export async function resolveEnumerable<T>(val: unknown): Promise<T[]> {
  if (val instanceof SwellStorefrontCollection) {
    const iterator = await val.iterator();
    return [...iterator] as T[];
  } else if (val instanceof Drop && Symbol.iterator in val) {
    const iterFn = val[Symbol.iterator];

    if (typeof iterFn === 'function') {
      const iter = (await iterFn.call(val)) as ArrayIterator<T>;
      return [...iter] as T[];
    }
  }

  if (!Array.isArray(val)) {
    return toEnumerable(val);
  }

  return val as T[];
}

export function stringify(value: unknown): string {
  value = toValue(value);
  if (isString(value)) return value;
  if (isNil(value)) return '';
  if (isArray(value)) return value.map((x) => stringify(x)).join('');
  return String(value);
}

export function paramsToProps(
  params: (string | [string, unknown])[] | Record<string, string>,
): Record<string, unknown> {
  // Convert array formatted params to props object
  if (Array.isArray(params)) {
    return params.reduce((acc: Record<string, unknown>, param, index) => {
      if (Array.isArray(param)) {
        const [key, value] = param;

        acc[key] = value;
      } else if (index % 2 === 0) {
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

  if (typeof value === 'undefined') {
    value = null;
  } else {
    await resolveAllKeys(value);
  }

  // Catch circular references, for example StorefrontResource
  const references = new WeakSet();

  return JSON.stringify(
    value,
    (_key: string, value: unknown) => {
      if (isObject(value)) {
        if (references.has(value)) {
          // Ignore circular reference
          return;
        }

        references.add(value);
      }

      return value;
    },
    space,
  );
}

export async function resolveAllKeys(
  value: unknown,
  references: WeakSet<object> = new WeakSet(),
) {
  await forEachKeyDeep(value as Record<string, unknown>, async (key, value) => {
    if (!isObject(value)) {
      return true;
    }
    const val = value[key];
    if (isLikePromise(val)) {
      value[key] = await val;
      await resolveAllKeys(value[key], references);
    } else if (isObject(val)) {
      if (val instanceof DeferredShopifyResource) {
        value[key] = await val.resolve();
        await resolveAllKeys(value[key], references);
        return true;
      }

      if (references.has(val)) {
        // Ignore circular reference
        return false;
      }

      references.add(val);
    }

    return true;
  });
}

async function forEachKeyDeep(
  obj: Record<string, unknown>,
  fn: (key: string, value: Record<string, unknown>) => Promise<boolean>,
) {
  if (!isObject(obj)) {
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const result = await fn(key, obj);

    if (result !== false) {
      if (isObject(value)) {
        await forEachKeyDeep(value, fn);
      }
    }
  }
}
