import { cloneDeep } from 'lodash-es';

import { ShopifyCompatibility } from '../shopify';

import { isObject } from '@/liquid/utils';

import type { StorefrontResource } from '@/resources';

export class ShopifyResource {
  props: { [key: string]: any };
  stringProp?: string;
  linkProps?: string[];

  constructor(props: any, stringProp?: string, linkProps?: string[]) {
    this.props = props;
    this.stringProp = stringProp;
    this.linkProps = linkProps;

    return new Proxy(props, {
      get: (target, prop) => {
        const instance = target as any;

        if (prop === 'toJSON') {
          return props;
        }

        if (prop === 'clone') {
          return () => {
            return new ShopifyResource(cloneDeep(props));
          };
        }

        if (prop === 'toString' && stringProp) {
          return () => {
            return props[stringProp];
          };
        }

        if (instance[prop] instanceof DeferredShopifyResource) {
          return instance[prop]
            .resolve()
            .then((value: any) => {
              instance[prop] = value;
              return value;
            })
            .catch((err: any) => {
              console.log(err);
              instance[prop] = null;
              return null;
            });
        }

        return instance[prop];
      },

      getPrototypeOf() {
        return ShopifyResource.prototype;
      },
    });
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
      this.result = Promise.resolve(this.handler()).then((value) => {
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

function isStorefrontResource(resource: unknown): resource is StorefrontResource {
  return isObject(resource) && typeof resource._resolve === 'function'
}

export async function resolveAsyncProp<R>(asyncProp: unknown): Promise<R> {
  return Array.isArray(asyncProp)
    ? Promise.all(
        asyncProp.map((prop) =>
          isStorefrontResource(prop) ? prop._resolve() : prop,
        ),
      )
    : isStorefrontResource(asyncProp)
    ? asyncProp._resolve()
    : asyncProp as R;
}

export async function handleDeferredProp<T, R>(asyncProp: unknown, handler: (...value: R[]) => T): Promise<T | null> {
  return resolveAsyncProp<R>(asyncProp)
    .then((value) => {
      if (Array.isArray(asyncProp) && Array.isArray(value)) {
        return handler(...value.map((prop) => prop || {}));
      }

      if (isResolvable(value)) {
        return handleDeferredProp<T, R>(value, handler);
      }

      return handler(value || ({} as R));
    })
    .catch((err) => {
      console.log(err);
      return null;
    });
}

export function deferWith<T, R>(asyncProp: unknown, handler: (...value: R[]) => T) {
  return new DeferredShopifyResource<T | null>(() =>
    handleDeferredProp(asyncProp, handler),
  );
}

export function deferSwellCollectionWithShopifyResults(
  instance: ShopifyCompatibility,
  asyncProp: any,
  key: string,
  ShopifyObject: any,
  handler?: Function,
) {
  return deferWith(asyncProp, (value: any) => {
    return (
      value[key]?._cloneWithCompatibilityResult((valueResult: any) => {
        return {
          results: valueResult?.results?.map((result: any) => {
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
