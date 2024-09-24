import { cloneDeep } from 'lodash-es';

import { ShopifyCompatibility } from '../shopify';

import { isObject } from '@/liquid/utils';

import type { StorefrontResource, SwellStorefrontCollection } from '@/resources';
import type { SwellData, SwellRecord } from 'types/swell';

export class ShopifyResource {
  props: Record<string, unknown>;
  stringProp?: string;
  linkProps?: string[];

  constructor(props: Record<string, any>, stringProp?: string, linkProps?: string[]) {
    this.props = props;
    this.stringProp = stringProp;
    this.linkProps = linkProps;

    return new Proxy(props, {
      get(target, prop: string) {
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

          default:
            break;
        }

        if (instance[prop] instanceof DeferredShopifyResource) {
          return instance[prop]
            .resolve()
            .then((value: unknown) => {
              instance[prop] = value;
              return value;
            })
            .catch((err: unknown) => {
              console.log(err);
              (instance[prop] as any) = null;
              return null;
            });
        }

        return instance[prop];
      },

      getPrototypeOf() {
        return ShopifyResource.prototype;
      },
    }) as ShopifyResource;
  }

  valueOf() {
    if (this.stringProp) {
      return this.props[this.stringProp];
    }
    return this;
  }

  // For typescript
  clone(): ShopifyResource {
    return new ShopifyResource({});
  }
}

export class DeferredShopifyResource<T> {
  private handler: () => Promise<T> | T;
  private result: Promise<T> | T | undefined | null;

  constructor(handler: () => Promise<T> | T) {
    this.handler = handler;
  }

  async resolve() {
    if (this.result === undefined) {
      this.result = Promise.resolve().then(() => this.handler()).then((value) => {
        this.result = value !== undefined ? value : null;
        return value;
      });
    }

    return this.result;
  }
}

export function defer<T>(handler: () => Promise<T> | T) {
  return new DeferredShopifyResource(handler);
}

export function isResolvable(asyncProp: unknown): boolean {
  return isObject(asyncProp) && (
    asyncProp instanceof Promise || typeof asyncProp._resolve === 'function'
  );
}

function isStorefrontResource<T extends SwellData>(resource: unknown): resource is StorefrontResource<T> {
  return isObject(resource) && typeof resource._resolve === 'function'
}

export async function resolveAsyncProp<R extends SwellData>(asyncProp: unknown): Promise<R | R[] | null | undefined> {
  return Array.isArray(asyncProp)
    ? Promise.all<R[]>(
        asyncProp.map((prop) =>
          isStorefrontResource<R>(prop) ? prop._resolve() : prop,
        ),
      )
    : isStorefrontResource<R>(asyncProp)
    ? asyncProp._resolve()
    : asyncProp as R;
}

export async function handleDeferredProp<T, R extends SwellData>(asyncProp: unknown, handler: (...value: R[]) => T): Promise<T | null> {
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
      return null;
    });
}

export function deferWith<T, R extends SwellData = SwellData>(
  asyncProp: unknown, handler: (...value: R[]) => T
): DeferredShopifyResource<T | null> {
  return new DeferredShopifyResource<T | null>(() =>
    handleDeferredProp(asyncProp, handler),
  );
}

export function deferSwellCollectionWithShopifyResults<
  T extends Record<string, SwellStorefrontCollection>,
  R extends ShopifyResource,
>(
  instance: ShopifyCompatibility,
  asyncProp: unknown,
  key: string,
  ShopifyObject: (instance: ShopifyCompatibility, result: SwellRecord) => R,
  handler?: (shopifyResult: R, result: SwellRecord) => void,
) {
  return deferWith<SwellStorefrontCollection, T>(asyncProp, (value) => {
    return (
      (value[key])?._cloneWithCompatibilityResult((valueResult) => {
        return {
          results: valueResult?.results?.map((result) => {
            const shopifyResult = ShopifyObject(instance, result);
            if (handler) {
              handler(shopifyResult, result);
            }
            return shopifyResult;
          }),
        };
      }) || []
    );
  });
}
