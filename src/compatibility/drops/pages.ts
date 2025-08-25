import { Drop } from 'liquidjs';

import { isLikePromise } from '@/liquid/utils';
import { SwellStorefrontCollection, SwellStorefrontRecord } from '@/resources';
import { ShopifyPage, type ShopifyResource } from '../shopify-objects';

import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyPageObject } from 'types/shopify';

class PagesDrop extends Drop {
  #instance: ShopifyCompatibility;
  #map: Map<string, ShopifyResource<ShopifyPageObject>>;

  constructor(instance: ShopifyCompatibility) {
    super();
    this.#instance = instance;
    this.#map = new Map();
  }

  liquidMethodMissing(key: unknown): unknown {
    switch (typeof key) {
      case 'string': {
        return this.getPage(key);
      }

      case 'object': {
        if (key !== null) {
          const obj = key as Record<string, unknown>;
          const id = (obj.handle || obj.id || obj._id) as string;

          if (isLikePromise(id)) {
            return id.then((id) => this.getPage(id as string));
          }

          return this.getPage(id);
        }

        break;
      }

      default:
        break;
    }
  }

  getPage(slug: string): ShopifyResource<ShopifyPageObject> {
    let resource = this.#map.get(slug);

    if (resource === undefined) {
      resource = ShopifyPage(
        this.#instance,
        new SwellStorefrontRecord(this.#instance.swell, 'content/pages', slug),
      );

      this.#map.set(slug, resource);
    }

    return resource;
  }
}

export default class Pages extends SwellStorefrontCollection<ShopifyPageObject> {
  #drop: PagesDrop;

  constructor(instance: ShopifyCompatibility) {
    super(instance.swell, 'content/pages', {}, async () => {
      const response = await this._defaultGetter().call(this);

      if (!response) {
        return null;
      }

      return {
        ...response,
        page_count: response.page_count || 0,
        results: response.results.map((page) => ShopifyPage(instance, page)),
      };
    });

    this.#drop = new PagesDrop(instance);
  }

  toLiquid() {
    return this.#drop;
  }
}
