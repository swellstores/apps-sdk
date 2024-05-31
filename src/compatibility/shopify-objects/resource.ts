import cloneDeep from 'lodash/cloneDeep';

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

  constructor(handler: Function) {
    this.handler = handler;
  }

  resolve() {
    return Promise.resolve(this.handler());
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

export function deferWith(
  asyncProp: any,
  handler: Function,
  deferredClass: typeof DeferredShopifyResource = DeferredShopifyResource,
) {
  return new deferredClass(async () => {
    const promise =
      asyncProp instanceof Array
        ? Promise.all(
            asyncProp.map((prop: any) =>
              typeof prop?._resolve === 'function' ? prop._resolve() : prop,
            ),
          )
        : typeof asyncProp?._resolve === 'function'
        ? asyncProp._resolve()
        : asyncProp;

    return Promise.resolve(promise)
      .then((value: any) => {
        if (asyncProp instanceof Array) {
          return handler(...value.map((prop: any) => prop || {}));
        }
        return handler(value || {});
      })
      .catch((err: any) => {
        console.log(err);
        return null;
      });
  });
}

export function deferLink(handler: Function) {
  return defer(handler, DeferredShopifyLinkResource);
}

export function deferLinkWith(asyncProp: any, handler: Function) {
  return deferWith(asyncProp, handler, DeferredShopifyLinkResource);
}