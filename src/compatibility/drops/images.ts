import { Drop } from 'liquidjs';

import { isLikePromise } from '@/liquid/utils';
import { StorefrontResource } from '@/resources';
import { ShopifyResource } from '../shopify-objects';
import ShopifyImage from '../shopify-objects/image';

import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyImage as ShopifyImageType } from 'types/shopify';
import type { SwellCollection, SwellData } from 'types/swell';
import type { Swell } from '@/api';

export default class ImagesDrop extends Drop {
  #instance: ShopifyCompatibility;
  #map: Map<string, ShopifyResource<ShopifyImageType>>;

  constructor(instance: ShopifyCompatibility) {
    super();
    this.#instance = instance;
    this.#map = new Map();
  }

  liquidMethodMissing(key: unknown): unknown {
    switch (typeof key) {
      case 'string': {
        return this.getImage(key);
      }

      case 'object': {
        if (key !== null) {
          const obj = key as Record<string, unknown>;
          const id = (obj.handle || obj.id || obj._id) as string;

          if (isLikePromise(id)) {
            return id.then((id) => this.getImage(id as string));
          }

          return this.getImage(id);
        }

        break;
      }

      default:
        break;
    }
  }

  getImage(name: string): ShopifyResource<ShopifyImageType> {
    let resource = this.#map.get(name);

    if (resource === undefined) {
      resource = ShopifyImage(new SwellImage(this.#instance.swell, name));

      this.#map.set(name, resource);
    }

    return resource;
  }
}

class SwellImage extends StorefrontResource<SwellData> {
  constructor(swell: Swell, name: string) {
    super(async () => {
      const files = await swell.get<SwellCollection<SwellData>>('/:files', {
        private: { $ne: true },
        content_type: { $regex: '^image/' },
        filename: name,
      });

      const file = files?.results[0] ?? null;

      if (file === null) {
        return null;
      }

      return { file };
    });
  }
}
