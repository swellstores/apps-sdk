import cloneDeep from 'lodash/cloneDeep';
import { StorefrontResource } from '../../resources';

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

        if (prop === 'getLinkProps') {
          return () => {
            return linkProps;
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
  getLinkProps() {
    return this.linkProps;
  }
}

export class DeferredShopifyResource {
  private handler: Function;
  private result: any;

  constructor(handler: Function) {
    this.handler = handler;
  }

  resolve() {
    if (this.result === undefined) {
      this.result = Promise.resolve(this.handler()).then((value: any) => {
        this.result = value !== undefined ? value : null;
        return value;
      });
    }

    return this.result;
  }
}

// TODO: consider removing this if it's not used
export class DeferredShopifyLinkResource extends DeferredShopifyResource {}

export function defer(
  handler: Function,
  deferredClass: typeof DeferredShopifyResource = DeferredShopifyResource,
) {
  return new deferredClass(handler);
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

export function deferWith(
  asyncProp: any,
  handler: Function,
  deferredClass: typeof DeferredShopifyResource = DeferredShopifyResource,
) {
  return new deferredClass(() => handleDeferredProp(asyncProp, handler));
}

export function deferLink(handler: Function) {
  return defer(handler, DeferredShopifyLinkResource);
}

export function deferLinkWith(asyncProp: any, handler: Function) {
  return deferWith(asyncProp, handler, DeferredShopifyLinkResource);
}