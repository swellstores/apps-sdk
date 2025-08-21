import { Drop } from 'liquidjs';

import { isLikePromise } from '@/liquid/utils';
import { SwellStorefrontRecord } from '@/resources';
import { ShopifyBlog, ShopifyResource } from '../shopify-objects';

import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyBlog as ShopifyBlogType } from 'types/shopify';

export default class BlogsDrop extends Drop {
  #instance: ShopifyCompatibility;
  #map: Map<string, ShopifyResource<ShopifyBlogType>>;

  constructor(instance: ShopifyCompatibility) {
    super();
    this.#instance = instance;
    this.#map = new Map();
  }

  liquidMethodMissing(key: unknown): unknown {
    switch (typeof key) {
      case 'string': {
        return this.getBlog(key);
      }

      case 'object': {
        if (key !== null) {
          const obj = key as Record<string, unknown>;
          const id = (obj.handle || obj.id || obj._id) as string;

          if (isLikePromise(id)) {
            return id.then((id) => this.getBlog(id as string));
          }

          return this.getBlog(id);
        }

        break;
      }

      default:
        break;
    }
  }

  getBlog(slug: string): ShopifyResource<ShopifyBlogType> {
    let resource = this.#map.get(slug);

    if (resource === undefined) {
      resource = ShopifyBlog(
        this.#instance,
        new SwellStorefrontRecord(
          this.#instance.swell,
          'content/blog-categories',
          slug,
        ),
      );

      this.#map.set(slug, resource);
    }

    return resource;
  }
}
