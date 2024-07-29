import { cloneDeep } from 'lodash-es';
import { ShopifyCompatibility } from '../shopify';

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

export class DeferredShopifyResource {
  private handler: Function;
  private result: any;

  constructor(handler: Function) {
    this.handler = handler;
  }

  async resolve() {
    if (this.result === undefined) {
      this.result = Promise.resolve(this.handler()).then((value: any) => {
        this.result = value !== undefined ? value : null;
        return value;
      });
    }

    return this.result;
  }
}

export function defer(handler: Function) {
  return new DeferredShopifyResource(handler);
}

export function isResolvable(asyncProp: any) {
  return (
    asyncProp instanceof Promise || typeof asyncProp?._resolve === 'function'
  );
}

export async function resolveAsyncProp(asyncProp: any) {
  return asyncProp instanceof Array
    ? Promise.all(
        asyncProp.map((prop: any) =>
          typeof prop?._resolve === 'function' ? prop._resolve() : prop,
        ),
      )
    : typeof asyncProp?._resolve === 'function'
    ? asyncProp._resolve()
    : asyncProp;
}

export async function handleDeferredProp(asyncProp: any, handler: Function) {
  return resolveAsyncProp(asyncProp)
    .then((value: any): any => {
      if (isResolvable(value)) {
        return handleDeferredProp(value, handler);
      }
      if (asyncProp instanceof Array) {
        return handler(...value.map((prop: any) => prop || {}));
      }
      return handler(value || {});
    })
    .catch((err: any) => {
      console.log(err);
      return null;
    });
}

export function deferWith(asyncProp: any, handler: Function) {
  return new DeferredShopifyResource(() =>
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
