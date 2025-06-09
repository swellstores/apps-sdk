import {
  StorefrontResource,
  SwellStorefrontCollection,
  cloneStorefrontResource,
} from '@/resources';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyImage from './image';
import ShopifyFilter from './filter';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellCollection, SwellData, SwellRecord } from 'types/swell';
import type { ShopifyCollection } from 'types/shopify';
import SwellShopifyProduct from '@/compatibility/shopify-objects/product_swell';

interface ShopifyProductCollection {
  products?: SwellStorefrontCollection | SwellCollection;
}

export default function ShopifyCollection(
  instance: ShopifyCompatibility,
  category: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyCollection> {
  if (category instanceof ShopifyResource) {
    return category.clone() as ShopifyResource<ShopifyCollection>;
  }

  if (category instanceof StorefrontResource) {
    category = cloneStorefrontResource(category);
  }

  const resolveProducts = makeProductsCollectionResolve(category, (product) =>
    SwellShopifyProduct(instance, product as SwellRecord),
  );

  return new ShopifyResource<ShopifyCollection>({
    all_products_count: defer(
      async () => (await resolveProducts())?.count || 0,
    ),
    all_tags: defer(async () => {
      const resolved = await resolveProducts();

      if (!resolved) {
        return [];
      }

      const set = new Set<string>();

      await Promise.all(
        resolved.results.map(async (product) => {
          const tags = await Promise.resolve().then(() => product.tags);

          if (Array.isArray(tags)) {
            for (const tag of tags) {
              set.add(tag);
            }
          }
        }),
      );

      return Array.from(set.values());
    }),
    all_types: defer(async () => {
      const products = await resolveProducts();

      if (!products?.results) {
        return [];
      }

      const types = new Set<string>();

      await Promise.all(
        products.results.map(async (product) => {
          const type = await Promise.resolve().then(() => product.type);

          if (type) {
            types.add(type);
          }
        }),
      );

      return Array.from(types.values());
    }),
    all_vendors: [],
    current_type: undefined,
    current_vendor: undefined,
    default_sort_by: deferWith(category, (category) =>
      convertToShopifySorting(category.sort_options?.[0].value ?? ''),
    ),
    description: defer(() => category.description),
    featured_image: deferWith(category, (category) =>
      getFirstImage(instance, category),
    ),
    filters: defer(async () =>
      ((await resolveProducts())?.filter_options ?? []).map((filter) =>
        ShopifyFilter(instance, filter),
      ),
    ),
    handle: defer(() => category.slug),
    id: defer(() => category.id),
    image: deferWith(category, (category) => getFirstImage(instance, category)),
    metafields: {},
    next_product: undefined,
    previous_product: undefined,
    products: defer(async () => {
      return (await resolveProducts())?.results ?? [];
    }),
    products_count: defer(
      async () => (await resolveProducts())?.results?.length || 0,
    ),
    published_at: deferWith(
      category,
      (category) => category.date_updated || category.date_created,
    ),
    sort_by: defer(() => category.sort),
    sort_options: defer(() => category.sort_options),
    tags: [],
    template_suffix: undefined,
    title: defer(() => category.name),
    url: deferWith(category, (category) => `/collections/${category.slug}`),
  });
}

function getFirstImage(instance: ShopifyCompatibility, category: SwellData) {
  const image = category.images?.[0];
  return image ? ShopifyImage(instance, image) : undefined;
}

function convertToShopifySorting(value: string) {
  switch (value) {
    case 'popularity':
      return 'best-selling';
    case 'name_asc':
      return 'title-ascending';
    case 'price_asc':
      return 'price-ascending';
    case 'price_desc':
      return 'price-descending';
    case 'date_asc':
      return 'created-ascending';
    case 'date_desc':
      return 'created-descending';

    case '':
    default:
      return 'manual';
  }
}

export function makeProductsCollectionResolve<T extends SwellData>(
  object: StorefrontResource | SwellRecord,
  mapper: (product: SwellData) => T,
): () => Promise<SwellCollection<T> | null | undefined> {
  const productResults = deferWith<
    SwellStorefrontCollection<SwellCollection<T>> | SwellCollection<T> | null,
    ShopifyProductCollection
  >(object, (object) => {
    if (object.products) {
      if (object.products instanceof SwellStorefrontCollection) {
        return object.products._cloneWithCompatibilityResult<
          SwellCollection<T>
        >((products) => {
          return {
            ...products,
            results: products.results.map(mapper),
          };
        });
      }

      if (Array.isArray(object.products?.results)) {
        return {
          ...object.products,
          results: object.products.results.map(mapper),
        };
      }
    }

    return null;
  });

  async function resolveProducts(): Promise<
    SwellCollection<T> | null | undefined
  > {
    const resolved = await productResults.resolve();

    if (resolved && '_resolve' in resolved) {
      return resolved._resolve();
    }

    return resolved;
  }

  return resolveProducts;
}
