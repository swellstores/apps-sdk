import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyVariant from './variant';
import ShopifyImage from './image';
import ShopifyMedia from './media';

export default function ShopifyProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
  depth: number = 0,
): ShopifyResource | null {
  if (product instanceof ShopifyResource) {
    return product.clone();
  }

  // TODO: find a better way to prevent infinite loop
  if (depth > 1) {
    return null;
  }

  return new ShopifyResource({
    available: deferWith(
      product,
      () => product.stock_status === 'in_stock' || !product.stock_status,
    ),
    collections: [], // TODO: need to support this in the resource class somehow
    compare_at_price: defer(() => product.compare_price), // Note: This field hasn't been standardized as of May 2024
    compare_at_price_max: null,
    compare_at_price_min: null,
    compare_at_price_varies: false,
    content: defer(() => product.description),
    created_at: defer(() => product.date_created),
    description: defer(() => product.description),
    featured_image: deferWith(product, () => {
      return (
        product.images?.[0] &&
        ShopifyImage(instance, product.images[0], product)
      );
    }),
    featured_media: deferWith(
      product,
      () => product.images?.[0] && ShopifyMedia(instance, product.images[0]),
    ),
    first_available_variant: deferWith(product, (product: any) =>
      product.variants?.results?.find(
        (variant: any) =>
          variant.stock_status === 'in_stock' || variant.stock_status === null,
      ),
    ),
    gift_card: defer(() => product.type === 'giftcard'),
    handle: defer(() => product.slug),
    has_only_default_variant: deferWith(
      product,
      (product: any) => !product.options?.length,
    ),
    id: defer(() => product.id),
    images: deferWith(product, (product: any) =>
      product.images?.map(
        (image: any) => image && ShopifyImage(instance, image, product),
      ),
    ),
    media: deferWith(product, (product: any) =>
      product.images?.map((image: any) => ShopifyMedia(instance, image)),
    ),
    metafields: null,
    options: deferWith(product, (product: any) =>
      product.options
        ?.map((option: any) => option.active && option.name)
        .filter(Boolean),
    ),
    options_by_name: deferWith(product, (product: any) =>
      product.options
        ?.filter((option: any) => option.active)
        .reduce((acc: any, option: any, index: number) => {
          return {
            ...acc,
            [option.name?.toLowerCase()]: {
              name: option.name,
              position: index + 1,
              selected_value: null,
              values: option.values?.map((value: any) =>
                ShopifyProductOption({
                  id: value.id,
                  name: value.name,
                  product_url: null,
                  selected: false,
                  swatch: null,
                  variant: null,
                }),
              ),
            },
          };
        }, {}),
    ),
    options_with_values: deferWith(product, (product: any) =>
      product.options?.map((option: any, index: number) => ({
        name: option.name,
        position: index + 1,
        selected_value: null,
        values: option.values?.map((value: any) =>
          ShopifyProductOption({
            id: value.id,
            name: value.name,
            product_url: null,
            selected: false,
            swatch: null,
            variant: null,
          }),
        ),
      })),
    ),
    price: defer(() => product.price),
    price_max: deferWith(product, (product: any) =>
      product.variants?.results?.reduce(
        (max: any, variant: any) => Math.max(max, variant.price),
        0,
      ),
    ),
    price_min: deferWith(product, (product: any) =>
      product.variants?.results?.reduce(
        (min: any, variant: any) => Math.min(min, variant.price),
        Infinity,
      ),
    ),
    price_varies: deferWith(product, (product: any) =>
      product.variants?.results?.some(
        (variant: any) => variant.price !== product.price,
      ),
    ),
    published_at: defer(() => product.date_created),
    quantity_price_breaks_configured: defer(() => product.prices?.length > 0),
    requires_selling_plan: false,
    selected_or_first_available_selling_plan_allocation: null,
    selected_or_first_available_variant: deferWith(product, (product: any) => {
      const selectedVariant = instance.swell.queryParams.variant
        ? product.variants?.results?.reverse().find(
            (variant: any) =>
              variant.id === instance.swell.queryParams.variant && // Selected by url param `variant`
              (variant.stock_status === 'in_stock' || !variant.stock_status),
          )
        : null;
      const selectedOrFirstVariant =
        selectedVariant ||
        product.variants?.results
          ?.reverse()
          .find(
            (variant: any) =>
              variant.stock_status === 'in_stock' || !variant.stock_status,
          );
      return selectedOrFirstVariant
        ? ShopifyVariant(instance, selectedOrFirstVariant, product, depth + 1)
        : ShopifyProduct(instance, product, depth + 1); // TODO: make sure this works correctly
    }),
    selected_selling_plan: null,
    selected_variant: null,
    selling_plan_groups: null,
    tags: defer(() => product.tags),
    template_suffix: null,
    title: defer(() => product.name),
    type: defer(() => product.type),
    url: defer(() => `/products/${product.slug}`), // TODO: pass theme settings to get this correctly
    variants: deferWith(product, (product: any) =>
      // Note variants must be in the same order as options
      product.variants?.results
        ?.map((variant: any) =>
          ShopifyVariant(instance, variant, product, depth + 1),
        )
        .reverse(),
    ),
    vendor: null,
  });
}

export function ShopifyProductOption(values: SwellData) {
  return new ShopifyResource(values, 'name');
}
