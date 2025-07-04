import { Drop } from 'liquidjs';

import { isObject } from '@/utils';
import { isLikePromise } from '@/liquid/utils';
import { SwellStorefrontRecord, SwellStorefrontCollection } from '@/resources';

import {
  ShopifyCollection,
  ShopifyProduct,
  ShopifyResource,
} from '../shopify-objects';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellCollection, SwellData, SwellRecord } from 'types/swell';
import type { ShopifyCollection as ShopifyCollectionType } from 'types/shopify';

// TODO: remove this once backend is implemented for "all"
class AllCategoryResource<
  T extends SwellData = SwellRecord,
> extends SwellStorefrontRecord<T> {
  constructor(instance: ShopifyCompatibility) {
    super(instance.swell, 'categories', 'all', {}, () => {
      const category: SwellData = {
        id: 'all',
        slug: 'all',
        name: 'Products',
        products: new SwellStorefrontProducts(instance, { $variants: true }),
      };

      return category as T;
    });
  }
}

export default class CollectionsDrop extends Drop {
  #instance: ShopifyCompatibility;
  #categories?: ShopifyResource<ShopifyCollectionType>[];
  #size: number;
  #map: Map<string, ShopifyResource<ShopifyCollectionType>>;

  constructor(instance: ShopifyCompatibility) {
    super();
    this.#instance = instance;
    this.#size = Number.NaN;
    this.#map = new Map();
  }

  liquidMethodMissing(key: unknown): unknown {
    switch (typeof key) {
      case 'string': {
        if (key === 'all') {
          let resource = this.#map.get(key);

          if (resource === undefined) {
            resource = ShopifyCollection(
              this.#instance,
              new AllCategoryResource(this.#instance),
            );

            this.#map.set(key, resource);
          }

          return resource;
        }

        return this.getCollection(key);
      }

      case 'object': {
        if (key !== null) {
          const obj = key as Record<string, unknown>;
          const id = (obj.handle || obj.id || obj._id) as string;

          if (isLikePromise(id)) {
            return id.then((id) => this.getCollection(id as string));
          }

          return this.getCollection(id);
        }

        break;
      }

      default:
        break;
    }
  }

  getCollection(slug: string): ShopifyResource<ShopifyCollectionType> {
    let resource = this.#map.get(slug);

    if (resource === undefined) {
      resource = ShopifyCollection(
        this.#instance,
        new SwellStorefrontCategory(this.#instance, slug),
      );

      this.#map.set(slug, resource);
    }

    return resource;
  }

  get size(): Promise<number> | number {
    if (!Number.isFinite(this.#size)) {
      return this.#instance.swell.storefront
        .get('/categories/:count')
        .then((count) => {
          const size = Number(count ?? 0);
          this.#size = size;
          return size;
        });
    }

    return this.#size;
  }

  [Symbol.iterator]() {
    return this.iterator();
  }

  async iterator() {
    if (!this.#categories) {
      this.#categories = await this.#instance.swell.storefront.categories
        .list()
        .then((res) => {
          return res.results.map((category) =>
            ShopifyCollection(
              this.#instance,
              new SwellStorefrontCategory(this.#instance, category.slug),
            ),
          );
        });
    }

    return this.#categories.values();
  }
}

class SwellStorefrontCategory extends SwellStorefrontRecord<SwellData> {
  constructor(instance: ShopifyCompatibility, id: string, query?: SwellData) {
    super(instance.swell, 'categories', id, query, async () => {
      const category = new SwellStorefrontRecord(
        instance.swell,
        'categories',
        id,
        query,
      );

      const record = await category.resolve();

      if (isObject(record) && record.id) {
        record.products = new SwellStorefrontProducts(
          instance,
          {
            category: record.id,
            $variants: true,
          },
          (result) => {
            return {
              ...result,
              results: result.results.map(
                (product) =>
                  ShopifyProduct(instance, product) as unknown as SwellRecord,
              ),
            };
          },
        );
      }

      return record;
    });
  }
}

class SwellStorefrontProducts extends SwellStorefrontCollection<
  SwellCollection<SwellRecord>
> {
  constructor(
    instance: ShopifyCompatibility,
    query?: SwellData,
    transform?: (
      result: SwellCollection<SwellRecord>,
    ) => SwellCollection<SwellRecord>,
  ) {
    super(instance.swell, 'products', query, async function () {
      const result = await this._defaultGetter().call(this);

      if (!result) {
        return result;
      }

      return transform ? transform(result) : result;
    });
  }
}
