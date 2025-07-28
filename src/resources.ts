import { cloneDeep } from 'lodash-es';

import { md5, resolveAsyncResources, stringifyQueryParams } from './utils';
import { logger, createTraceId } from './utils/logger';
import { isLikePromise } from './liquid/utils';

import type { Swell } from './api';
import type { ShopifyCompatibility } from './compatibility/shopify';
import type {
  SwellData,
  SwellRecord,
  SwellCollection,
  InferSwellCollection,
  SwellCollectionPages,
  StorefrontResourceGetter,
  StorefrontCollectionGetter,
} from '../types/swell';

export const MAX_QUERY_PAGE_LIMIT = 100;
export const DEFAULT_QUERY_PAGE_LIMIT = 15;

export class StorefrontResource<T extends SwellData = SwellData> {
  public _getter?: StorefrontResourceGetter<T>;
  public _getterHash?: string;
  public _result?: T | null;
  public _compatibilityProps: SwellData = {};

  [key: string]: any;

  constructor(getter?: StorefrontResourceGetter<T>) {
    if (getter) {
      this._setGetter(getter);
    }

    return this._getProxy();
  }

  _getProxy(): StorefrontResource<T> {
    return new Proxy(this, {
      get(target, prop: string): unknown {
        const instance = target;

        switch (prop) {
          // Ignore liquid prop checks
          case 'toLiquid':
          case 'next':
            return;

          // Indicate props are thenable
          case 'then':
            return false;

          case 'toJSON':
          case 'toObject':
            return () => instance.toObject();

          default:
            break;
        }

        // Return functions and props starting with _ directly
        if (
          typeof instance[prop] === 'function' ||
          (typeof prop === 'string' && prop.startsWith('_'))
        ) {
          return instance[prop];
        }

        if (typeof prop === 'symbol') {
          if (prop === Symbol.toStringTag) {
            if (isLikePromise(instance._result)) {
              return '[object Promise]';
            } else if (instance._result !== undefined) {
              return '[object Object]';
            } else {
              return 'undefined';
            }
          }

          return instance[prop];
        }

        // Get resource result if not yet fetched
        if (instance._result === undefined) {
          if (instance[prop] !== undefined) {
            // Return prop if already defined
            return instance[prop];
          }

          instance._result = instance._get().catch((err: unknown) => {
            logger.error(err);
            return instance._getCollectionResultOrProp(instance, prop);
          }) as unknown as T;
        }

        // Return prop then if result is a promise
        if (isLikePromise(instance._result)) {
          return instance._result
            .then(() => {
              return instance._getCollectionResultOrProp(instance, prop);
            })
            .catch((err: unknown) => {
              logger.error(err);
              return null;
            });
        }

        return instance._getCollectionResultOrProp(instance, prop);
      },

      set(target, prop: string, value: unknown): boolean {
        target[prop] = value;
        return true;
      },

      ownKeys(target): (string | symbol)[] {
        if (typeof target._isEmpty === 'function' && target._isEmpty()) {
          return [];
        }
        const allStringProps = Object.getOwnPropertyNames(target);
        const allSymbolProps = Object.getOwnPropertySymbols(target);
        const allProps: (string | symbol)[] = [
          ...allStringProps,
          ...allSymbolProps,
        ];

        return allProps;
      },
    });
  }

  _getCollectionResultOrProp(
    instance: StorefrontResource<T>,
    prop: string | number,
  ): unknown {
    if (instance._result && Array.isArray(instance._result.results)) {
      const record =
        instance._result.results.find(
          (result: SwellRecord) => result.slug === prop || result.id === prop,
        ) ||
        (typeof prop === 'number' ? instance._result.results[prop] : undefined);

      if (record) {
        return record;
      }
    }

    if (prop in instance._compatibilityProps) {
      return instance._compatibilityProps[prop];
    }

    if (instance._result && prop in instance._result) {
      return instance._result[prop];
    }

    return instance[prop];
  }

  // add additional properties to the loaded result
  _transformResult(result?: T | null) {
    return result;
  }

  async _get(..._args: unknown[]): Promise<T | null | undefined> {
    if (this._getter) {
      const getter = this._getter.bind(
        this as unknown as SwellStorefrontResource<T>,
      );

      return Promise.resolve()
        .then(getter)
        .then((result) => {
          return this._transformResult(result);
        })
        .then((result) => {
          this._result = result;

          if (result) {
            Object.assign(this, result);
          }

          return result;
        })
        .catch((err) => {
          logger.error(err);
          return null;
        });
    }

    return this._result;
  }

  _setGetter(getter: StorefrontResourceGetter<T>): void {
    if (this._swell) {
      // Use loading handler for editor indicator
      this._getter = async (...args) => {
        this._swell.isLoading(true);
        const result = await getter.call(
          this as unknown as SwellStorefrontResource<T>,
          ...args,
        );
        this._swell.isLoading(false);
        return result;
      };
    } else {
      this._getter = getter;
    }
    this._getterHash = md5(getter.toString());
  }

  async _resolve() {
    if (this._result === undefined) {
      this._result = this._get() as unknown as T;
    }

    return this._result;
  }

  _isResultResolved(): boolean {
    return this._result !== undefined && !isLikePromise(this._result);
  }

  async resolve(
    resolveStorefrontResources: boolean = true,
    resourceMetadata: boolean = false,
  ) {
    const result = await this._resolve();
    if (result === null) {
      return null;
    }

    const combined = Object.assign({}, result, this._compatibilityProps);

    return resolveAsyncResources(
      combined,
      resolveStorefrontResources,
      resourceMetadata,
    );
  }

  toObject() {
    if (this._result === null) {
      return null;
    }

    const combined = Object.assign({}, this._result, this._compatibilityProps);

    return combined;
  }

  toJSON() {
    return this.toObject();
  }

  valueOf() {
    return this.resolve();
  }

  setCompatibilityProps(props: SwellData): void {
    this._compatibilityProps = props;
  }

  [Symbol.toPrimitive](_type: string): unknown {
    return this._id;
  }

  getCompatibilityProp<
    T extends keyof StorefrontResource['_compatibilityProps'],
  >(prop: T): StorefrontResource['_compatibilityProps'][T] {
    return this._compatibilityProps[prop];
  }
}

/**
 * Clone the resource without compatibility properties.
 *
 * Compatibility properties cause a bug with hanging promises when we retrieve properties from `StorefrontResource`.
 * This is due to the cyclic retrieval of properties in `StorefrontResource`.
 *
 * First we request a property from `_compatibilityProps`,
 * and then `_compatibilityProps` requests a property from `StorefrontResource` via a deferred handler.
 */
export function cloneStorefrontResource<T extends SwellData = SwellData>(
  input: StorefrontResource<T>,
): StorefrontResource<T> {
  const resourceName = input._resourceName as string;
  const clone = new StorefrontResource(input._getter);

  // clone query parameters and result transformation function
  clone._params = input._params as SwellData;
  clone._transformResult = input._transformResult.bind(clone);

  Object.defineProperty(clone.constructor, 'name', {
    value: resourceName,
  });

  Object.defineProperty(clone, '_resourceName', {
    value: resourceName,
  });

  return clone;
}

export class SwellStorefrontResource<
  T extends SwellData = SwellData,
> extends StorefrontResource<T> {
  public _swell: Swell;
  public _resource: any;
  public _resourceName!: string;

  public readonly _collection: string;
  public _query: SwellData = {};

  public _compatibilityInstance: ShopifyCompatibility | null = null;

  constructor(
    swell: Swell,
    collection: string,
    getter?: StorefrontResourceGetter<T>,
  ) {
    super(getter);
    this._swell = swell;
    this._collection = collection;

    return this._getProxy();
  }

  _getProxy(): SwellStorefrontResource<T> {
    return super._getProxy() as SwellStorefrontResource<T>;
  }

  getResourceObject(): {
    get: (
      id?: string,
      query?: SwellData,
    ) => Promise<InferSwellCollection<T> | null>;
    list: (
      query?: SwellData,
    ) => Promise<T extends SwellCollection ? T : SwellCollection<T>>;
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

    if (!this._resource?.get) {
      throw new Error(
        `Swell storefront resource for collection '${_collection}' does not exist.`,
      );
    }

    return this._resource;
  }
}

export class SwellStorefrontCollection<
  T extends SwellCollection<SwellData> = SwellCollection<SwellData>,
> extends SwellStorefrontResource<T> {
  public length: number = 0;
  public results?: InferSwellCollection<T>[];
  public count?: number;
  public page?: number;
  public pages?: SwellCollectionPages;
  public page_count?: number;
  public limit: number = DEFAULT_QUERY_PAGE_LIMIT;
  public name?: string;

  constructor(
    swell: Swell,
    collection: string,
    query: SwellData = {},
    getter?: StorefrontCollectionGetter<T>,
  ) {
    super(swell, collection, getter as StorefrontResourceGetter<T>);

    this._query = this._initQuery(query);

    if (!getter) {
      this._setGetter(this._defaultGetter());
    }

    return this._getProxy();
  }

  _getProxy(): SwellStorefrontCollection<T> {
    return super._getProxy() as SwellStorefrontCollection<T>;
  }

  _initQuery(query: SwellData): SwellData {
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

  _defaultGetter(): StorefrontResourceGetter<T> {
    const resource = this.getResourceObject();

    async function defaultGetter(this: SwellStorefrontResource<T>) {
      return resource.list(this._query);
    }

    return defaultGetter as StorefrontResourceGetter<T>;
  }

  async _get(query: SwellData = {}): Promise<T | null | undefined> {
    const { currency, locale } = this._swell.getStorefrontLocalization();

    this._query = {
      ...this._query,
      ...query,
      $currency: currency,
      $locale: locale,
    };

    if (this._getter) {
      const getter = this._getter.bind(this);

      this._result = this._swell
        .getCachedResource(
          'storefront-list',
          [
            this._collection,
            this._query,
            this._swell.queryParams,
            this._getterHash,
          ],
          getter,
        )
        .then((result?: T | null) => {
          this._result = result;

          if (result) {
            Object.assign(this, result, {
              length: result.results?.length || 0,
            });
          }

          return result;
        })
        .catch((err) => {
          logger.error(err);
          return null;
        }) as unknown as T;
    }

    return this._result;
  }

  [Symbol.iterator]() {
    return this.iterator();
  }

  iterator() {
    return (this.results || []).values();
  }

  _clone(newProps?: SwellData): SwellStorefrontCollection<T> {
    const cloned = new SwellStorefrontCollection<T>(
      this._swell,
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

  _cloneWithCompatibilityResult<
    R extends SwellCollection<SwellData> = SwellCollection<SwellData>,
  >(compatibilityGetter: (result: T) => R): SwellStorefrontCollection<R> {
    const originalGetter = this._getter;

    const cloned = this._clone({
      _getter: async () => {
        const result = await originalGetter?.call(cloned);

        if (result) {
          const compatibilityProps = compatibilityGetter(result);
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
        const compatibilityProps = compatibilityGetter(result);

        Object.assign(cloned, result);

        if (compatibilityProps) {
          Object.assign(cloned, compatibilityProps);
        }
      }
    }

    return cloned as unknown as SwellStorefrontCollection<R>;
  }
}

export class SwellStorefrontRecord<
  T extends SwellData = SwellRecord,
> extends SwellStorefrontResource<T> {
  public _id: string;
  public _params: SwellData;

  constructor(
    swell: Swell,
    collection: string,
    id: string,
    query: SwellData = {},
    getter?: StorefrontResourceGetter<T>,
  ) {
    super(swell, collection, getter);

    this._id = id;
    this._query = query;
    this._params = {};

    if (!getter) {
      this._setGetter(this._defaultGetter());
    }

    return this._getProxy();
  }

  _getProxy(): SwellStorefrontRecord<T> {
    return super._getProxy() as SwellStorefrontRecord<T>;
  }

  _defaultGetter(): StorefrontResourceGetter<T> {
    const resource = this.getResourceObject();

    async function defaultGetter(this: SwellStorefrontRecord<T>) {
      return resource.get(this._id, this._query);
    }

    return defaultGetter as StorefrontResourceGetter<T>;
  }

  async _get(id: string, query: SwellData = {}): Promise<T | null | undefined> {
    this._id = id || this._id;

    const { currency, locale } = this._swell.getStorefrontLocalization();

    this._query = {
      ...this._query,
      ...query,
      $currency: currency,
      $locale: locale,
    };

    if (this._getter) {
      const getter = this._getter.bind(this);

      this._result = this._swell
        .getCachedResource(
          'storefront-record',
          [
            this._collection,
            this._id,
            this._query,
            this._swell.queryParams,
            this._getterHash,
          ],
          getter,
        )
        .then((result?: T | null) => {
          return this._transformResult(result);
        })
        .then((result?: T | null) => {
          this._result = result;

          if (result) {
            Object.assign(this, result);
          }

          return result;
        })
        .catch((err: unknown) => {
          logger.error(err);
          return null;
        }) as unknown as T;
    }

    return this._result;
  }
}

export class SwellStorefrontSingleton<
  T extends SwellData = SwellData,
> extends SwellStorefrontResource<T> {
  constructor(
    swell: Swell,
    collection: string,
    getter?: StorefrontResourceGetter<T>,
  ) {
    super(swell, collection, getter);

    if (!getter) {
      this._setGetter(this._defaultGetter());
    }

    return this._getProxy();
  }

  _getProxy(): SwellStorefrontSingleton<T> {
    return super._getProxy() as SwellStorefrontSingleton<T>;
  }

  _defaultGetter(): StorefrontResourceGetter<T> {
    const {
      _collection,
      _swell: { storefrontContext },
    } = this;

    const resource = this.getResourceObject();

    async function defaultGetter(this: SwellStorefrontSingleton<T>) {
      // Try and fetch from context first
      if (storefrontContext[_collection] !== undefined) {
        return storefrontContext[_collection];
      }

      // Otherwise fetch from source (Storefront API)
      return resource.get();
    }

    return defaultGetter as StorefrontResourceGetter<T>;
  }

  async _get() {
    if (this._getter) {
      const trace = createTraceId();
      logger.debug('[SDK] Resource fetch start', {
        resource: this.constructor.name,
        hash: this._getterHash,
        trace,
      });

      const getter = this._getter.bind(this);

      this._result = Promise.resolve()
        .then(getter)
        .then((result?: T | null) => {
          logger.debug('[SDK] Resource fetch end', {
            hash: this._getterHash,
            trace,
          });
          this._result = result;

          if (result) {
            Object.assign(this, result);
          }

          return result;
        })
        .catch((err: unknown) => {
          logger.error(err, { trace });
          return null;
        }) as unknown as T;
    }

    return this._result;
  }
}

export class SwellStorefrontPagination<
  T extends SwellCollection = SwellCollection,
> {
  public _resource: SwellStorefrontCollection<T>;

  public count = 0;
  public page = 0;
  public page_count = 0;
  public limit = 0;
  public pages: Record<string, { start: number; end: number; url: string }> =
    {};
  public next?: { start: number; end: number; url: string };
  public previous?: { start: number; end: number; url: string };

  constructor(resource: SwellStorefrontCollection<T>) {
    this._resource = resource;
    this.setPaginationProps();
  }

  setPaginationProps(): void {
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
          url: this.getPageUrl(Number(page)),
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

  getPageUrl(page: number): string {
    const { url, queryParams } = this._resource._swell;
    return `${url.pathname}?${stringifyQueryParams({
      ...queryParams,
      page,
    })}`;
  }

  setCompatibilityProps(props: SwellData): void {
    Object.assign(this, props);
  }
}
