import { StorefrontResource, SwellStorefrontCollection } from '../../resources';

import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';
import ShopifyImage from './image';
import ShopifyFilter from './filter';

import type { SwellCollection, SwellRecord } from 'types/swell';

interface ShopifyProductCollection {
  products?: SwellStorefrontCollection;
}

export default function ShopifyCollection(
  instance: ShopifyCompatibility,
  category: StorefrontResource | SwellRecord,
): ShopifyResource {
  if (category instanceof ShopifyResource) {
    return category.clone();
  }

  const productResults = deferWith(category, (category: ShopifyProductCollection) => {
    return (
      category.products?._cloneWithCompatibilityResult((products) => {
        return {
          results: products?.results?.map((product) =>
            ShopifyProduct(instance, product),
          ),
        };
      }) ?? null
    );
  });

  async function productsResolved(): Promise<SwellCollection | null | undefined> {
    const resolved = await productResults.resolve();

    if (resolved && '_resolve' in resolved) {
      return resolved._resolve();
    }

    return resolved;
  }

  return new ShopifyResource({
    all_products_count: defer(
      async () => (await productsResolved())?.count || 0,
    ),
    all_tags: defer(
      async () =>
        (await productsResolved())?.results?.reduce(
          (types: any[], product) => {
            if (Array.isArray(product.tags)) {
              types.push(...product.tags);
            }

            return types;
          },
          [],
        ) || [],
    ),
    all_types: defer(
      async () => {
        const products = await productsResolved();

        if (!products?.results) {
          return [];
        }

        const types = products.results.reduce(
          (set, product) => {
            if (product.type) {
              set.add(product.type);
            }

            return set;
          },
          new Set<string>(),
        );

        return Array.from(types.values());
    }),
    all_vendors: [],
    current_type: null,
    current_vendor: null,
    default_sort_by: deferWith(
      category,
      (category: any) => category.sort_options?.[0].value,
    ),
    description: deferWith(category, (category: any) => category.description),
    featured_image: deferWith(
      category,
      (category: any) =>
        category.images?.[0] && ShopifyImage(instance, category.images[0]),
    ),
    filters: defer(
      async () =>
        (await productsResolved() as any)?.filter_options?.map((filter: any) =>
          ShopifyFilter(instance, filter),
        ) || [],
    ),
    handle: defer(() => category.slug),
    id: deferWith(category, (category: any) => category.id),
    image: null,
    metafields: null,
    next_product: null,
    previous_product: null,
    products: productResults,
    products_count: defer(
      async () => (await productsResolved())?.results?.length || 0,
    ),
    published_at: null,
    sort_by: defer(() => category.sort),
    sort_options: deferWith(category, (category: any) => category.sort_options),
    tags: [],
    template_suffix: null,
    title: defer(() => category.name),
    url: deferWith(
      category,
      (category: any) => `/collections/${category.slug}`,
    ),
  });
}

