import { cloneDeep, noop } from 'lodash-es';

import { isLikePromise, isObject } from '@/liquid/utils';

import type { StorefrontResource } from '@/resources';
import type { SwellData } from 'types/swell';

type DeferShopifyResource<T extends object> = {
  [K in keyof T]: NonNullable<T[K]> extends Array<infer U>
    ? U extends object
      ?
          | U[]
          | ShopifyResource<U>[]
          | DeferredShopifyResource<U[] | ShopifyResource<U>[]>
      : U[] | DeferredShopifyResource<U[]>
    : NonNullable<T[K]> extends object
      ?
          | T[K]
          | ShopifyResource<NonNullable<T[K]>>
          | DeferredShopifyResource<T[K] | ShopifyResource<NonNullable<T[K]>>>
      : T[K] | DeferredShopifyResource<T[K]>;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ShopifyResource<T extends object> {
  props: DeferShopifyResource<T>;
  stringProp?: keyof T;
  linkProps?: string[];

  constructor(
    props: DeferShopifyResource<T>,
    stringProp?: keyof T,
    linkProps?: string[],
  ) {
    this.props = props;
    this.stringProp = stringProp;
    this.linkProps = linkProps;

    return new Proxy<DeferShopifyResource<T>>(props, {
      get(target, prop, receiver) {
        const instance = target;

        switch (prop) {
          case 'toJSON':
            return props;

          case 'clone':
            return () => {
              return new ShopifyResource(
                cloneDeep(props),
                cloneDeep(stringProp),
                cloneDeep(linkProps),
              );
            };

          case 'toString': {
            if (stringProp) {
              return () => {
                return props[stringProp];
              };
            }

            break;
          }

          case Symbol.toPrimitive: {
            return () => {
              let prop: string | symbol | number | undefined = stringProp;

              if (typeof prop === 'number') {
                prop = prop.toString();
              }

              return this.get?.(instance, prop || 'handle', receiver);
            };
          }

          default:
            break;
        }

        const value = instance[prop as keyof T];

        if (value instanceof DeferredShopifyResource) {
          const promise = value.resolve().then(
            (value: T[keyof T]) => {
              (instance as T)[prop as keyof T] = value;
              return value;
            },
            (err: unknown) => {
              console.log(err);
              (instance as T)[prop as keyof T] = null as T[keyof T];
              return null;
            },
          );

          (instance as T)[prop as keyof T] = promise as T[keyof T];

          return promise;
        }

        return value;
      },

      getPrototypeOf() {
        return ShopifyResource.prototype;
      },
    }) as ShopifyResource<T> & T;
  }

  valueOf() {
    if (this.stringProp) {
      return this.props[this.stringProp];
    }
    return this;
  }

  // For typescript
  clone(): ShopifyResource<T> {
    return new ShopifyResource<T>(this.props);
  }
}

type AddProperties<T extends object> = T;

// @ts-expect-error: ShopifyResource extends generic with same type
export interface ShopifyResource<T extends object> extends AddProperties<T> {}

export class DeferredShopifyResource<T> {
  private handler: () => Promise<T> | T;
  private result: Promise<T> | T | undefined;

  constructor(handler: () => Promise<T> | T) {
    this.result = undefined;
    this.handler = handler;
  }

  async resolve() {
    if (this.handler !== noop) {
      const handler = this.handler;
      // Reset handler as it will no longer be used (free memory)
      this.handler = noop as () => Promise<T> | T;

      this.result = Promise.resolve()
        .then(handler)
        .then((value) => {
          this.result = value;
          return value;
        });
    }

    return this.result;
  }
}

export function defer<T>(
  handler: () => Promise<T> | T,
): DeferredShopifyResource<T> {
  return new DeferredShopifyResource<T>(handler);
}

export function isResolvable(asyncProp: unknown): boolean {
  return (
    isObject(asyncProp) &&
    (isLikePromise(asyncProp) || typeof asyncProp._resolve === 'function')
  );
}

function isStorefrontResource<T extends SwellData>(
  resource: unknown,
): resource is StorefrontResource<T> {
  return isObject(resource) && typeof resource._resolve === 'function';
}

export async function resolveAsyncProp<R extends SwellData>(
  asyncProp: unknown,
): Promise<R | R[] | null | undefined> {
  if (Array.isArray(asyncProp)) {
    return Promise.all<R[]>(
      asyncProp.map((prop) =>
        isStorefrontResource<R>(prop) ? prop._resolve() : prop,
      ),
    );
  }

  if (isStorefrontResource<R>(asyncProp)) {
    return asyncProp._resolve();
  }

  return asyncProp as R;
}

export function handleDeferredProp<T, R extends SwellData>(
  asyncProp: unknown,
  handler: (...value: R[]) => T,
): Promise<T> {
  return resolveAsyncProp<R>(asyncProp)
    .then((value) => {
      if (Array.isArray(asyncProp) && Array.isArray(value)) {
        return handler(...value.map((prop) => prop || {}));
      }

      if (isResolvable(value)) {
        return handleDeferredProp<T, R>(value, handler);
      }

      return handler((value || {}) as R);
    })
    .catch((err) => {
      console.log(err);
      return null as T;
    });
}

export function deferWith<T, R extends SwellData = SwellData>(
  asyncProp: unknown,
  handler: (...value: R[]) => T,
): DeferredShopifyResource<T> {
  return new DeferredShopifyResource<T>(() =>
    handleDeferredProp(asyncProp, handler),
  );
}
