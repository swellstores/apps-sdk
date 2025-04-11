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
      (product: SwellRecord) =>
        product.stock_status === 'in_stock' || !product.stock_status,
    ),
    collections: [], // TODO: need to support this in the resource class somehow
    compare_at_price: defer(() => product.orig_price), // Note: This field hasn't been standardized as of May 2024
    compare_at_price_max: null,
    compare_at_price_min: null,
    compare_at_price_varies: false,
    content: defer(() => product.description),
    created_at: defer(() => product.date_created),
    description: deferWith(
      product,
      (product: SwellRecord) => product.description,
    ),
    featured_image: deferWith(product, (product: SwellRecord) => {
      return (
        product.images?.[0] &&
        ShopifyImage(instance, product.images[0], product)
      );
    }),
    featured_media: deferWith(
      product,
      (product: SwellRecord) =>
        product.images?.[0] && ShopifyMedia(instance, product.images[0]),
    ),
    first_available_variant: deferWith(product, (product: SwellRecord) =>
      // it returns first variant with empty query
      getSelectedVariant(product, {}),
    ),
    'gift_card?': deferWith(
      product,
      (product: SwellRecord) => product.type === 'giftcard',
    ),
    handle: defer(() => product.slug),
    has_only_default_variant: deferWith(
      product,
      (product: SwellRecord) => !product.options?.length,
    ),
    id: deferWith(product, (product: SwellRecord) => product.id),
    images: deferWith(product, (product: SwellRecord) =>
      product.images?.map(
        (image: any) => image && ShopifyImage(instance, image, product),
      ),
    ),
    media: deferWith(product, (product: SwellRecord) =>
      product.images?.map((image: any) => ShopifyMedia(instance, image)),
    ),
    metafields: null,
    options: deferWith(product, (product: SwellRecord) =>
      product.options
        ?.map((option: any) => option.active && option.name)
        .filter(Boolean),
    ),
    options_by_name: deferWith(product, (product: SwellRecord) =>
      product.options?.reduce((acc: any, option: any, index: number) => {
        if (option.active) {
          acc[option.name?.toLowerCase()] = {
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
          };
        }

        return acc;
      }, {}),
    ),
    options_with_values: deferWith(product, (product: SwellRecord) => {
      const variant = getSelectedVariant(product, instance.swell.queryParams);
      const optionValues = variant?.option_value_ids || [];

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
    price: deferWith(product, (product: SwellRecord) => product.price),
    price_max: deferWith<number, SwellRecord>(product, (product) =>
      product.variants?.results?.reduce(
        (max: number, variant: any) => Math.max(max, variant.price),
        0,
      ),
    ),
    price_min: deferWith<number, SwellRecord>(product, (product) =>
      product.variants?.results?.reduce(
        (min: number, variant: any) => Math.min(min, variant.price),
        Infinity,
      ),
    ),
    price_varies: deferWith<boolean, SwellRecord>(product, (product) =>
      product.variants?.results?.some(
        (variant: any) => variant.price !== product.price,
      ),
    ),
    published_at: defer(() => product.date_created),
    'quantity_price_breaks_configured?': deferWith(
      product,
      (product: SwellRecord) => product.prices?.length > 0,
    ),
    quantity_rule: deferWith(product, (product: SwellRecord) => {
      let inventory = product.stock_level || 0;
      if (inventory < 0) {
        inventory = 0;
      }
      const max = !product.stock_status ? null : inventory;
      return {
        min: 1,
        max,
        increment: 1,
      };
    }),
    inventory_quantity: deferWith(product, (product: any) => {
      if (!product.stock_status) {
        return Infinity;
      }

      let inventory = product.stock_level || 0;
      if (inventory < 0) {
        inventory = 0;
      }
      return inventory;
    }),
    requires_selling_plan: false,
    selected_or_first_available_selling_plan_allocation: null,
    selected_or_first_available_variant: deferWith(
      product,
      (product: SwellRecord) => {
        const variant = getSelectedVariant(product, instance.swell.queryParams);

        return variant
          ? ShopifyVariant(instance, variant, product, depth + 1)
          : ShopifyProduct(instance, product, depth + 1); // TODO: make sure this works correctly
      },
    ),
    selected_selling_plan: null,
    selected_variant: null,
    selling_plan_groups: null,
    tags: deferWith(product, (product: SwellRecord) => product.tags),
    template_suffix: null,
    title: defer(() => product.name),
    type: deferWith(product, (product: SwellRecord) => product.type),
    url: deferWith(
      product,
      (product: SwellRecord) => `/products/${product.slug}`,
    ), // TODO: pass theme settings to get this correctly
    variants: deferWith(product, (product: SwellRecord) => {
      // Note variants must be in the same order as options
      const variants = product.variants?.results
        ?.map((variant: any) =>
          ShopifyVariant(instance, variant, product, depth + 1),
        )
        .reverse();

      return variants;
    }),
    vendor: null,
  });
}

export function ShopifyProductOption(values: SwellData) {
  return new ShopifyResource(values, 'name');
}

function getSelectedVariant(product: SwellRecord, queryParams: SwellData) {
  const { variant: queryVariant, option_values: queryOptionValues } =
    queryParams;
  const variants = getAvailableVariants(product);

  let selectedVariant = null;

  if (queryVariant) {
    selectedVariant = variants.find(
      (variant: any) => variant.id === queryVariant,
    );
  } else if (queryOptionValues) {
    const optionValues = queryOptionValues.split(',');

    selectedVariant = variants.find((variant: any) =>
      variant.option_value_ids.every((optionValueId: string) =>
        optionValues.includes(optionValueId),
      ),
    );
  }

  return selectedVariant || variants?.[0] || null;
}

function getAvailableVariants(product: SwellRecord) {
  // Using slice() to avoid mutating the original array with reverse()
  return (product.variants?.results?.slice()?.reverse() || []).filter(
    (variant: any) =>
      variant.stock_status === 'in_stock' || !variant.stock_status,
  );
}
