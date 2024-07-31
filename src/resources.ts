import { Swell } from './api';
import { ShopifyCompatibility } from './compatibility/shopify';
import { md5, resolveAsyncResources, stringifyQueryParams } from './utils';
import cloneDeep from 'lodash/cloneDeep';

export const MAX_QUERY_PAGE_LIMIT = 100;
export const DEFAULT_QUERY_PAGE_LIMIT = 15;
export const CACHE_TIMEOUT_RESOURCES = 1000 * 5; // 5s

export class StorefrontResource {
  public _getter?: StorefrontResourceGetter;
  public _getterHash?: string;
  public _result?: SwellData | null;
  public _compatibilityProps: SwellData = {};

  [key: string]: any;

  constructor(getter?: StorefrontResourceGetter) {
    if (getter) {
      this._setGetter(getter);
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
          return false;
        }

        if (prop === 'toJSON' || prop === 'toObject') {
          return () => instance.toObject();
        }

        // Return functions and props starting with _ directly
        if (typeof instance[prop] === 'function' || prop.startsWith?.('_')) {
          return instance[prop];
        }

        if (typeof prop === 'symbol') {
          if (prop === Symbol.toStringTag) {
            if (instance._result instanceof Promise) {
              return '[object Promise]';
            } else if (instance._result !== undefined) {
              return '[object Object]';
            } else {
              return 'undefined';
            }
          }
        }

        // Get resource result if not yet fetched
        if (instance._result === undefined) {
          if (instance[prop] !== undefined) {
            // Return prop if already defined
            return instance[prop];
          }

          instance._result = instance._get().catch((err: any) => {
            console.log(err);
            return instance._getCollectionResultOrProp(instance, prop);
          });
        }

        // Return prop then if result is a promise
        if (instance._result instanceof Promise) {
          return instance._result
            .then(() => {
              return instance._getCollectionResultOrProp(instance, prop);
            })
            .catch((err: any) => {
              console.log(err);
              return null;
            });
        }

        return instance._getCollectionResultOrProp(instance, prop);
      },

      set(target: StorefrontResource, prop: any, value: any): boolean {
        target[prop] = value;
        return true;
      },
    });
  }

  _getCollectionResultOrProp(instance: any, prop: string) {
    if (Array.isArray(instance._result?.results)) {
      const record =
        instance._result.results.find(
          (result: SwellRecord) => result.slug === prop || result.id === prop,
        ) || instance._result.results[prop];
      if (record) {
        return record;
      }
    }

    if (prop in instance._compatibilityProps) {
      return instance._compatibilityProps[prop];
    } else if (instance._result && prop in instance._result) {
      return instance._result[prop];
    }

    return instance[prop];
  }

  async _get(..._args: any): Promise<any> {
    if (this._getter) {
      this._result = Promise.resolve(this._getter())
        .then((result: any) => {
          this._result = result;

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

  _setGetter(getter: StorefrontResourceGetter) {
    this._getter = getter;
    this._getterHash = md5(getter.toString());
  }

  async _resolve() {
    if (this._result === undefined) {
      return await this._get();
    }
    return this._result;
  }

  _isResultResolved() {
    return this._result !== undefined && !(this._result instanceof Promise);
  }

  async resolve() {
    const combined = {};

    const result = await this._resolve();
    if (result === null) {
      return null;
    }

    Object.assign(combined, result);
    Object.assign(combined, this._compatibilityProps);

    return await resolveAsyncResources(combined);
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
  public _swell: Swell;
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

    if (swell instanceof Swell) {
      this._swell = swell;
    } else {
      throw new Error('Storefront resource requires `swell` instance.');
    }

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
      const type = _collection.split('/')[1]?.replace(/\/$/, '').trim();
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
  public limit: number = DEFAULT_QUERY_PAGE_LIMIT;

  constructor(
    swell: Swell,
    collection: string,
    query: SwellData = {},
    getter?: StorefrontResourceGetter,
  ) {
    super(swell, collection, getter);

    this._query = this._initQuery(query);

    if (!getter) {
      this._setGetter(this._defaultGetter());
    }

    return this._getProxy();
  }

  _getProxy() {
    return super._getProxy() as SwellStorefrontCollection;
  }

  _initQuery(query: SwellData) {
    const properQuery = query ? query : {};

    if (
      properQuery.limit > MAX_QUERY_PAGE_LIMIT ||
      properQuery.limit === null
    ) {
      properQuery.limit = MAX_QUERY_PAGE_LIMIT; // Max limit vs. 1000 on server
    } else if (!properQuery.limit) {
      properQuery.limit = DEFAULT_QUERY_PAGE_LIMIT;
    }

    this.limit = properQuery.limit;

    return properQuery;
  }

  _defaultGetter(): StorefrontResourceGetter {
    const resource = this.getResourceObject();
    return async function (this: SwellStorefrontCollection) {
      return resource.list(this._query);
    };
  }

  async _get(query: SwellData = {}) {
    this._query = {
      ...this._query,
      ...query,
    };

    this._result = this._swell
      .getCachedResource(
        'storefront-list',
        [this._collection, this._query, this._getterHash],
        async () => {
          console.log(
            'SwellStorefrontCollection._get',
            this._collection,
            this._query,
          );
          return (this._getter as StorefrontResourceGetter).call(this);
        },
      )
      .then((result: SwellCollection) => {
        this._result = result;

        if (result) {
          Object.assign(this, result, {
            length: result.results?.length || 0,
          });
        }

        return result;
      })
      .catch((err: any) => {
        console.log(err);
        return null;
      });

    return this._result;
  }

  [Symbol.iterator]() {
    return this.iterator();
  }

  *iterator() {
    for (const result of this.results || []) {
      yield result;
    }
  }

  _clone(newProps?: SwellData) {
    const cloned = new SwellStorefrontCollection(
      this._swell as Swell,
      this._collection,
      this._query,
      this._getter,
    );

    if (this._isResultResolved()) {
      cloned._result = cloneDeep(this._result);
    }

    if (this._compatibilityProps) {
      cloned.setCompatibilityProps(this._compatibilityProps);
    }

    if (newProps !== undefined) {
      Object.assign(cloned, newProps);

      if (newProps._getter) {
        cloned._setGetter(newProps._getter);
      }
    }

    return cloned;
  }

  _cloneWithCompatibilityResult(
    compatibilityGetter: (result: SwellCollection) => SwellData,
  ) {
    const originalGetter = this._getter;

    const cloned = this._clone({
      _getter: async () => {
        const result = await originalGetter?.call(cloned);

        if (result) {
          const compatibilityProps = compatibilityGetter(
            result as SwellCollection,
          );
          return {
            ...result,
            ...(compatibilityProps || undefined),
          };
        }

        return result;
      },
    });

    // Assign compatibility props on existing result if already resolved
    if (this._isResultResolved()) {
      const result = cloneDeep(this._result);
      if (result) {
        const compatibilityProps = compatibilityGetter(
          result as SwellCollection,
        );

        Object.assign(cloned, result);

        if (compatibilityProps) {
          Object.assign(cloned, compatibilityProps);
        }
      }
    }

    return cloned;
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
      this._setGetter(this._defaultGetter());
    }

    return this._getProxy();
  }

  _getProxy() {
    return super._getProxy() as SwellStorefrontRecord;
  }

  _defaultGetter(): StorefrontResourceGetter {
    const resource = this.getResourceObject();
    return async function (this: SwellStorefrontRecord) {
      return resource.get(this._id, this._query);
    };
  }

  async _get(id: string, query: SwellData = {}) {
    this._id = id || this._id;

    this._query = {
      ...this._query,
      ...query,
    };

    this._result = this._swell
      .getCachedResource(
        'storefront-record',
        [this._collection, this._id, this._query, this._getterHash],
        async () => {
          return (this._getter as StorefrontResourceGetter).call(this);
        },
      )
      .then((result: SwellRecord) => {
        this._result = result;

        if (result) {
          Object.assign(this, result);
        }

        return result;
      })
      .catch((err: any) => {
        console.log(err);
        return null;
      });

    return this._result;
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
      this._setGetter(this._defaultGetter());
    }

    return this._getProxy();
  }

  _getProxy() {
    return super._getProxy() as SwellStorefrontSingleton;
  }

  _defaultGetter(): StorefrontResourceGetter {
    const resource = this.getResourceObject();
    return async function (this: SwellStorefrontSingleton) {
      return resource.get();
    };
  }

  async _get() {
    this._result = (this._getter as StorefrontResourceGetter)
      .call(this)
      .then((result: SwellRecord) => {
        this._result = result;

        if (result) {
          Object.assign(this, result);
        }

        return result;
      })
      .catch((err: any) => {
        console.log(err);
        return null;
      });

    return this._result;
  }
}

export class SwellStorefrontPagination {
  public _resource: SwellStorefrontCollection;

  public count = 0;
  public page = 0;
  public page_count = 0;
  public limit = 0;
  public pages: {
    [key: string]: { start: number; end: number; url: string };
  } = {};
  public next?: { start: number; end: number; url: string };
  public previous?: { start: number; end: number; url: string };

  constructor(resource: SwellStorefrontCollection) {
    this._resource = resource;

    if (resource instanceof SwellStorefrontCollection) {
      this.setPaginationProps();
    }
  }

  setPaginationProps() {
    const { _resource } = this;

    this.count = _resource.count || 0;
    this.page = _resource.page || 0;
    this.page_count = _resource.page_count || 0;
    this.limit = _resource.limit || 0;

    this.pages = {};
    if (_resource.pages) {
      for (const [page, props] of Object.entries(_resource.pages)) {
        this.pages[page] = {
          start: props.start,
          end: props.end,
          url: this.getPageUrl(page),
        };
      }
    }

    const nextPage = this.pages[this.page + 1];
    this.next = nextPage
      ? {
          start: nextPage.start,
          end: nextPage.end,
          url: this.getPageUrl(this.page + 1),
        }
      : undefined;

    const prevPage = this.pages[this.page - 1];
    this.previous = prevPage
      ? {
          start: prevPage.start,
          end: prevPage.end,
          url: this.getPageUrl(this.page - 1),
        }
      : undefined;
  }

  getPageUrl(page: number) {
    const { url, queryParams } = this._resource._swell as Swell;
    return `${url.pathname}?${stringifyQueryParams({
      ...queryParams,
      page,
    })}`;
  }

  setCompatibilityProps(props: SwellData) {
    Object.assign(this, props);
  }
}