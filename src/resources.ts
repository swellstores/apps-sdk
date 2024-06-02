import isObject from 'lodash/isObject';
import { DeferredShopifyResource } from './compatibility/shopify-objects';

export const CACHE_TIMEOUT_RESOURCES = 1000 * 5; // 5s

export class StorefrontResource implements StorefrontResource {
  public _getter: StorefrontResourceGetter | undefined;
  public _result: SwellData | null | undefined;
  public _compatibilityProps: SwellData = {};

  [key: string]: any;

  constructor(getter?: StorefrontResourceGetter) {
    if (getter) {
      this._getter = getter;
    }

    return this._getProxy();
  }

  _getProxy() {
    return new Proxy(this, {
      get(target: StorefrontResource, prop: any): any {
        const instance = target as any;

        // Ignore liquid prop checks
        if (prop === 'toLiquid' || prop === 'next') {
          return;
        }

        // Indicate props are thenable
        if (prop === 'then') {
          return Boolean(
            instance._result instanceof Promise || instance._result,
          );
        }

        if (prop === 'toJSON' || prop === 'toObject') {
          return () => instance.toObject();
        }

        // Return functions and props starting with _ directly
        if (typeof instance[prop] === 'function' || prop.startsWith?.('_')) {
          return instance[prop];
        }

        // Get resource result if not yet fetched
        if (instance._result === undefined) {
          instance._result = instance
            ._get()
            .then((result: any) => {
              // Merge result after resolution
              Object.assign(instance, result);
              Object.assign(instance, instance._compatibilityProps);
              return instance[prop];
            })
            .catch((err: any) => {
              console.log(err);
              return instance[prop];
            });

          // Return prop if already defined
          if (instance[prop] !== undefined) {
            return instance[prop];
          }

          if (prop === Symbol.toStringTag) {
            return '[object Promise]';
          }
        } else if (prop === Symbol.toStringTag) {
          return '[object Object]';
        }

        // Return prop then if result is a promise
        if (instance._result instanceof Promise) {
          return instance._result
            .then(() => {
              return instance[prop];
            })
            .catch((err: any) => {
              console.log(err);
              return null;
            });
        }

        return instance[prop];
      },

      set(target: StorefrontResource, prop: any, value: any): boolean {
        target[prop] = value;
        return true;
      },
    });
  }

  async _get(..._args: any): Promise<any> {
    if (this._getter) {
      this._result = Promise.resolve(this._getter())
        .then((result: any) => {
          if (result) {
            Object.assign(this, result);
          }
          return result;
        })
        .catch((err: any) => {
          console.log(err);
          return null;
        });
    }
    return this._result;
  }

  async _resolve() {
    if (this._result === undefined) {
      await this._get();
    }
    return this._result;
  }

  async _resolveCompatibilityProps(
    object = this._compatibilityProps,
    depth: number = 3,
  ): Promise<any> {
    let result: any = {};

    if (object instanceof Array) {
      return await Promise.all(
        object.map((item: any) => this._resolveCompatibilityProps(item, depth)),
      );
    }

    if (!object || !isObject(object)) {
      return object;
    }

    const keys = Object.keys(object);

    try {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as string;

        if (object[key] instanceof Promise) {
          result[key] = await object[key];
        } else if (
          // Resolve deferred resources but not deferred shopify links
          object[key] instanceof StorefrontResource ||
          object[key] instanceof DeferredShopifyResource
        ) {
          result[key] = await object[key].resolve();
        } else {
          result[key] = object[key];
        }

        // Resolve nested objects
        if (isObject(result[key])) {
          if (depth - 1 > 0) {
            result[key] = await this._resolveCompatibilityProps(
              result[key],
              depth - 1,
            );
          } else {
            delete result[key];
          }
        }
      }
    } catch (err) {
      console.log(err);
    }

    return result;
  }

  async resolve(compatibilityDepth?: number) {
    const combined = {};

    const result = await this._resolve();
    if (result === null) {
      return null;
    }

    const compatibilityProps = await this._resolveCompatibilityProps(
      this._compatibilityProps,
      compatibilityDepth,
    );

    Object.assign(combined, result);
    Object.assign(combined, compatibilityProps);

    return combined;
  }

  toObject() {
    if (this._result === null) {
      return null;
    }

    const combined = {};

    Object.assign(combined, this._result);
    Object.assign(combined, this._compatibilityProps);

    return combined;
  }

  toJSON() {
    return this.toObject();
  }

  valueOf() {
    return this.resolve();
  }

  setCompatibilityProps(props: SwellData) {
    this._compatibilityProps = props;
  }

  getCompatibilityProp(prop: string) {
    return this._compatibilityProps[prop];
  }
}

export class SwellStorefrontResource extends StorefrontResource {
  public _swell?: Swell = undefined;
  public _resource: any;

  public readonly _collection: string;
  public _query: SwellData = {};

  public _compatibilityInstance: ShopifyCompatibility | null = null;

  constructor(
    swell: Swell,
    collection: string,
    getter?: StorefrontResourceGetter,
  ) {
    super(getter);

    this._swell = swell;
    this._collection = collection;

    return this._getProxy();
  }

  _getProxy() {
    return super._getProxy() as SwellStorefrontResource;
  }

  getResourceObject(): {
    get: (id?: string, query?: SwellData) => Promise<SwellData>;
    list: (query?: SwellData) => Promise<SwellData>;
  } {
    const { _swell, _collection } = this;

    this._resource = (_swell?.storefront as any)[_collection];

    if (_swell && _collection.startsWith('content/')) {
      const type = _collection.split('/')[1];
      this._resource = {
        list: (query: SwellData) => _swell.storefront.content.list(type, query),
        get: (id: string, query: SwellData) =>
          _swell.storefront.content.get(type, id, query),
      };
    }

    if (!this._resource || !this._resource.get) {
      throw new Error(
        `Swell storefront resource for collection '${_collection}' does not exist.`,
      );
    }

    return this._resource;
  }
}

export class SwellStorefrontCollection extends SwellStorefrontResource {
  public length: number = 0;
  public results?: SwellRecord[];
  public count?: number;
  public page?: number;
  public pages?: SwellCollectionPages;
  public page_count?: number;

  constructor(
    swell: Swell,
    collection: string,
    query: SwellData = {},
    getter?: StorefrontResourceGetter,
  ) {
    super(swell, collection, getter);

    this._query = query;

    if (!getter) {
      this._getter = this._defaultGetter();
    }

    return this._getProxy();
  }

  _getProxy() {
    return super._getProxy() as SwellStorefrontCollection;
  }

  _defaultGetter(): StorefrontResourceGetter {
    const resource = this.getResourceObject();
    return async () => {
      return await resource.list(this._query);
    };
  }

  async _get(query: SwellData = {}) {
    this._query = {
      ...this._query,
      ...query,
    };

    if (this._swell) {
      this._result = await this._swell
        .getCached(
          'storefront-list',
          [this._collection, this._query],
          () => (this._getter as StorefrontResourceGetter)(),
          CACHE_TIMEOUT_RESOURCES,
        )
        .then((result: SwellCollection) => {
          if (result) {
            Object.assign(this, result, {
              length: result.results.length,
            });
          }

          return result;
        })
        .catch((err: any) => {
          console.log(err);
          return null;
        });
    }

    return this;
  }

  [Symbol.iterator]() {
    return this.iterator();
  }

  *iterator() {
    for (const result of this.results || []) {
      yield result;
    }
  }
}

export class SwellStorefrontRecord extends SwellStorefrontResource {
  public _id: string;
  public id?: string;

  constructor(
    swell: Swell,
    collection: string,
    id: string,
    query: SwellData = {},
    getter?: StorefrontResourceGetter,
  ) {
    super(swell, collection, getter);

    this._id = id;
    this._query = query;

    if (!getter) {
      this._getter = this._defaultGetter();
    }

    return this._getProxy();
  }

  _getProxy() {
    return super._getProxy() as SwellStorefrontRecord;
  }

  _defaultGetter(): StorefrontResourceGetter {
    const resource = this.getResourceObject();
    return async () => {
      return await resource.get(this._id, this._query);
    };
  }

  async _get(id: string, query: SwellData = {}) {
    this._id = id || this._id;

    this._query = {
      ...this._query,
      ...query,
    };

    if (this._swell) {
      this._result = await this._swell
        .getCached(
          'storefront-record',
          [this._collection, this._id, this._query],
          () => (this._getter as StorefrontResourceGetter)(),
          CACHE_TIMEOUT_RESOURCES,
        )
        .then((result: SwellRecord) => {
          if (result) {
            Object.assign(this, result);
          }

          return result;
        })
        .catch((err: any) => {
          console.log(err);
          return null;
        });
    }

    return this;
  }
}

export class SwellStorefrontSingleton extends SwellStorefrontResource {
  constructor(
    swell: Swell,
    collection: string,
    getter?: StorefrontResourceGetter,
  ) {
    super(swell, collection, getter);

    if (!getter) {
      this._getter = this._defaultGetter();
    }

    return this._getProxy();
  }

  _getProxy() {
    return super._getProxy() as SwellStorefrontSingleton;
  }

  _defaultGetter(): StorefrontResourceGetter {
    const resource = this.getResourceObject();
    return async () => {
      return await resource.get();
    };
  }

  async _get() {
    if (this._swell) {
      this._result = await (this._getter as StorefrontResourceGetter)()
        .then((result: SwellRecord) => {
          if (result) {
            Object.assign(this, result);
          }

          return result;
        })
        .catch((err: any) => {
          console.log(err);
          return null;
        });
    }

    return this;
  }
}
