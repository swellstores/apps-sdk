import { Drop } from 'liquidjs';

import { SwellStorefrontRecord, SwellStorefrontCollection } from '@/resources';

import { ShopifyCollection, ShopifyResource } from '../shopify-objects';

import type { Swell } from '@/api';
import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from '../../../types/swell';

// TODO: remove this once backend is implemented for "all"
class AllCategoryResource<
  T extends SwellData = SwellRecord,
> extends SwellStorefrontRecord<T> {
  constructor(swell: Swell) {
    super(swell, 'categories', 'all', {}, () => {
      const category = {
        id: 'all',
        slug: 'all',
        name: 'Products',
        products: new SwellStorefrontCollection(swell, 'products'),
      } as unknown as T;

      return category;
    });
  }
}

export default class CollectionsDrop extends Drop {
  #instance: ShopifyCompatibility;
  #categories?: ShopifyResource[];
  #size: number;
  #map: Map<string, ShopifyResource>;

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
              new AllCategoryResource(this.#instance.swell),
            );
          }

          return resource;
        }

        return this.getCollection(key);
      }

      case 'object': {
        if (key !== null) {
          const obj = key as Record<string, unknown>;
          const id = (obj.handle || obj.id || obj._id) as string;

          return this.getCollection(id);
        }

        break;
      }

      default:
        break;
    }
  }

  getCollection(slug: string): ShopifyResource {
    let resource = this.#map.get(slug);

    if (resource === undefined) {
      resource = ShopifyCollection(
        this.#instance,
        new SwellStorefrontRecord(this.#instance.swell, 'categories', slug),
      );
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
            ShopifyCollection(this.#instance, category as SwellRecord),
          );
        });
    }

    return this.#categories.values();
  }
}
