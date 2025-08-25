import { Drop } from 'liquidjs';

import { isLikePromise } from '@/liquid/utils';
import { SwellStorefrontRecord } from '@/resources';
import { ShopifyArticle, type ShopifyResource } from '../shopify-objects';

import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyArticle as ShopifyArticleType } from 'types/shopify';

export default class ArticlesDrop extends Drop {
  #instance: ShopifyCompatibility;
  #map: Map<string, ShopifyResource<ShopifyArticleType>>;

  constructor(instance: ShopifyCompatibility) {
    super();
    this.#instance = instance;
    this.#map = new Map();
  }

  liquidMethodMissing(key: unknown): unknown {
    switch (typeof key) {
      case 'string': {
        return this.getArticle(key);
      }

      case 'object': {
        if (key !== null) {
          const obj = key as Record<string, unknown>;
          const id = (obj.handle || obj.id || obj._id) as string;

          if (isLikePromise(id)) {
            return id.then((id) => this.getArticle(id as string));
          }

          return this.getArticle(id);
        }

        break;
      }

      default:
        break;
    }
  }

  getArticle(slug: string): ShopifyResource<ShopifyArticleType> {
    let resource = this.#map.get(slug);

    if (resource === undefined) {
      resource = ShopifyArticle(
        this.#instance,
        new SwellStorefrontRecord(this.#instance.swell, 'content/blogs', slug),
      );

      this.#map.set(slug, resource);
    }

    return resource;
  }
}
