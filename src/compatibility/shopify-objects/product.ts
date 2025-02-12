import { StorefrontResource } from '../../resources';

import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyVariant from './variant';
import ShopifyImage from './image';
import ShopifyMedia from './media';

import type { SwellData, SwellRecord } from 'types/swell';

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
      (product: any) =>
        product.stock_status === 'in_stock' || !product.stock_status,
    ),
    collections: [], // TODO: need to support this in the resource class somehow
    compare_at_price: defer(() => product.compare_price), // Note: This field hasn't been standardized as of May 2024
    compare_at_price_max: null,
    compare_at_price_min: null,
    compare_at_price_varies: false,
    content: defer(() => product.description),
    created_at: defer(() => product.date_created),
    description: deferWith(product, (product: any) => product.description),
    featured_image: deferWith(product, (product: any) => {
      return (
        product.images?.[0] &&
        ShopifyImage(instance, product.images[0], product)
      );
    }),
    featured_media: deferWith(
      product,
      (product: any) =>
        product.images?.[0] && ShopifyMedia(instance, product.images[0]),
    ),
    first_available_variant: deferWith(product, (product: any) =>
      product.variants?.results?.find(
        (variant: any) =>
          variant.stock_status === 'in_stock' || variant.stock_status === null,
      ),
    ),
    'gift_card?': deferWith(
      product,
      (product: any) => product.type === 'giftcard',
    ),
    handle: defer(() => product.slug),
    has_only_default_variant: deferWith(
      product,
      (product: any) => !product.options?.length,
    ),
    id: deferWith(product, (product: any) => product.id),
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
                  available: true,
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
    options_with_values: deferWith(product, (product: any) => {
      const { option_values } = instance.swell.queryParams;
      let optionValues = String(option_values || '').split(',');

      // select the first variant by default
      if (optionValues.length !== product.options?.length) {
        const variants = getAvailableVariants(product);
        const variant = variants[0];

        optionValues = variant?.option_value_ids || [];
      }

      return product.options?.map((option: any, index: number) => {
        return {
          name: option.name,
          position: index + 1,
          selected_value: null,
          values: option.values?.map((value: any) =>
            ShopifyProductOption({
              available: true,
              id: value.id,
              name: value.name,
              product_url: null,
              selected: optionValues.includes(value.id),
              swatch: null,
              variant: null,
            }),
          ),
        };
      });
    }),
    price: deferWith(product, (product: any) => product.price),
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
    'quantity_price_breaks_configured?': deferWith(
      product,
      (product: any) => product.prices?.length > 0,
    ),
    requires_selling_plan: false,
    selected_or_first_available_selling_plan_allocation: null,
    selected_or_first_available_variant: deferWith(product, (product: any) => {
      const { variant, option_values } = instance.swell.queryParams;
      const optionValues = String(option_values || '').split(',');
      const hasOptionValues = optionValues.length > 0;
      const variants = getAvailableVariants(product);

      let selectedVariant = null;

      if (variant) {
        selectedVariant = variants.find(
          (variant: any) => variant.id === variant,
        );
      } else if (hasOptionValues) {
        selectedVariant = variants.find((variant: any) =>
          variant.option_value_ids.every((optionValueId: string) =>
            optionValues.includes(optionValueId),
          ),
        );
      }

      const selectedOrFirstVariant = selectedVariant || variants?.[0] || null;

      return selectedOrFirstVariant
        ? ShopifyVariant(instance, selectedOrFirstVariant, product, depth + 1)
        : ShopifyProduct(instance, product, depth + 1); // TODO: make sure this works correctly
    }),
    selected_selling_plan: null,
    selected_variant: null,
    selling_plan_groups: null,
    tags: deferWith(product, (product: any) => product.tags),
    template_suffix: null,
    title: defer(() => product.name),
    type: deferWith(product, (product: any) => product.type),
    url: deferWith(product, (product: any) => `/products/${product.slug}`), // TODO: pass theme settings to get this correctly
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

function getAvailableVariants(product: any) {
  return (product.variants?.results?.reverse() || []).filter(
    (variant: any) =>
      variant.stock_status === 'in_stock' || !variant.stock_status,
  );
}
