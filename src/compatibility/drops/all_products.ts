import { Drop } from 'liquidjs';

import { isLikePromise } from '@/liquid/utils';
import { SwellStorefrontRecord } from '@/resources';
import { ShopifyProduct, type ShopifyResource } from '../shopify-objects';

import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyProduct as ShopifyProductType } from 'types/shopify';

export default class AllProductsDrop extends Drop {
  #instance: ShopifyCompatibility;
  #map: Map<string, ShopifyResource<ShopifyProductType>>;

  constructor(instance: ShopifyCompatibility) {
    super();
    this.#instance = instance;
    this.#map = new Map();
  }

  liquidMethodMissing(key: unknown): unknown {
    switch (typeof key) {
      case 'string': {
        return this.getProduct(key);
      }

      case 'object': {
        if (key !== null) {
          const obj = key as Record<string, unknown>;
          const id = (obj.handle || obj.id || obj._id) as string;

          if (isLikePromise(id)) {
            return id.then((id) => this.getProduct(id as string));
          }

          return this.getProduct(id);
        }

        break;
      }

      default:
        break;
    }
  }

  getProduct(slug: string): ShopifyResource<ShopifyProductType> | null {
    let resource = this.#map.get(slug);

    // Limit: 20 unique handles per page
    if (resource === undefined && this.#map.size < 20) {
      resource = ShopifyProduct(
        this.#instance,
        new SwellStorefrontRecord(this.#instance.swell, 'products', slug),
      );

      this.#map.set(slug, resource);
    }

    return resource ?? null;
  }
}
