import { Drop } from 'liquidjs';

import { isObject } from '@/utils';
import { isLikePromise } from '@/liquid/utils';
import {
  StorefrontResource,
  SwellStorefrontRecord,
  SwellStorefrontCollection,
} from '@/resources';

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
> extends StorefrontResource<T> {
  constructor(instance: ShopifyCompatibility) {
    super(() => {
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

class CollectionsDrop extends Drop {
  #instance: ShopifyCompatibility;
  #map: Map<string, ShopifyResource<ShopifyCollectionType>>;

  constructor(instance: ShopifyCompatibility) {
    super();
    this.#instance = instance;
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
}

export default class Collections extends SwellStorefrontCollection<
  SwellCollection<ShopifyCollectionType>
> {
  #drop: CollectionsDrop;

  constructor(instance: ShopifyCompatibility) {
    super(instance.swell, 'categories', {}, async () => {
      const response = await this._defaultGetter().call(this);

      if (!response) {
        return null;
      }

      return {
        ...response,
        page_count: response.page_count || 0,
        results: response.results.map((item) =>
          ShopifyCollection(instance, item as unknown as SwellRecord),
        ),
      };
    });

    this.#drop = new CollectionsDrop(instance);
  }

  toLiquid() {
    return this.#drop;
  }
}

class SwellStorefrontCategory extends StorefrontResource<SwellData> {
  constructor(instance: ShopifyCompatibility, id: string, query?: SwellData) {
    super(async () => {
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
