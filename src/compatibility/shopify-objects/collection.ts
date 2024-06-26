import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';
import ShopifyImage from './image';
import ShopifyFilter from './filter';

export default function ShopifyCollection(
  instance: ShopifyCompatibility,
  category: StorefrontResource | SwellRecord,
) {
  if (category instanceof ShopifyResource) {
    return category.clone();
  }

  return new ShopifyResource({
    all_products_count: deferWith(
      category.products,
      (products: any) => products?.count || 0,
    ),
    all_tags: deferWith(category.products, (products: any) => {
      return (
        products?.results?.reduce((types: any[], product: SwellRecord) => {
          return types.concat(product.tags || []);
        }, []) || []
      );
    }),
    all_types: deferWith(category.products, async (products: any) => {
      return (
        products?.results?.reduce((types: any[], product: SwellRecord) => {
          return types.concat(product.type || []);
        }, []) || []
      );
    }),
    all_vendors: [],
    current_type: null,
    current_vendor: null,
    default_sort_by: deferWith(
      category,
      (category: any) => category.sort_options?.[0].value,
    ),
    description: null,
    featured_image: deferWith(
      category,
      (category: any) =>
        category.images?.[0] && ShopifyImage(instance, category.images[0]),
    ),
    filters: deferWith(category, async (category: any) => {
      return (
        (await category.products?.filter_options)?.map((filter: any) =>
          ShopifyFilter(instance, filter),
        ) || []
      );
    }),
    handle: defer(() => category.slug),
    id: deferWith(category, (category: any) => category.id),
    image: null,
    metafields: null,
    next_product: null,
    previous_product: null,
    products: deferWith(category, (category: any) => {
      return (
        category.products?._cloneWithCompatibilityResult((products: any) => {
          return {
            results: products?.results?.map((product: any) =>
              ShopifyProduct(instance, product),
            ),
          };
        }) || []
      );
    }),
    products_count: deferWith(
      category,
      (category: any) => category.products?.results?.length || 0,
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

