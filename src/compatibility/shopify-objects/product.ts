import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyVariant from './variant';
import ShopifyImage from './image';
import ShopifyMedia from './media';
import ShopifyCollection from './collection';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type {
  SwellProduct,
  SwellProductOption,
  SwellProductOptionValue,
  SwellVariant,
} from '@/resources/swell_types';
import type {
  ShopifyProduct,
  ShopifyProductOption,
  ShopifyProductOptionValue,
} from 'types/shopify';
import {
  getSelectedVariant,
  getAvailableVariants,
  isOptionValueAvailable,
  isOptionValueSelected,
  isProductAvailable,
  isOptionAvailable,
  isGiftcard,
} from '@/resources/product_helpers';

export default function ShopifyProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyProduct>;

export default function ShopifyProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
  depth: number,
): ShopifyResource<ShopifyProduct> | null;

export default function ShopifyProduct(
  instance: ShopifyCompatibility,
  product: StorefrontResource | SwellRecord,
  depth: number = 0,
): ShopifyResource<ShopifyProduct> | null {
  if (product instanceof ShopifyResource) {
    return product.clone() as ShopifyResource<ShopifyProduct>;
  }

  if (product instanceof StorefrontResource) {
    product = cloneStorefrontResource(product);
  }

  // TODO: find a better way to prevent infinite loop
  if (depth > 1) {
    return null;
  }

  const compareAtPrice = deferWith(product, (product) =>
    instance.toShopifyPrice(product.orig_price || false),
  );

  return new ShopifyResource<ShopifyProduct>({
    available: deferWith(product, (product: SwellProduct) =>
      isProductAvailable(product),
    ),
    collections: deferWith(product, (product: SwellProduct) => {
      if (!Array.isArray(product.categories)) {
        return [];
      }

      return product.categories.map((category) =>
        ShopifyCollection(instance, category),
      );
    }),
    compare_at_price: compareAtPrice, // Note: This field hasn't been standardized as of May 2024
    compare_at_price_max: compareAtPrice,
    compare_at_price_min: compareAtPrice,
    compare_at_price_varies: false,
    content: defer(() => product.description),
    created_at: defer(() => product.date_created),
    description: defer(() => product.description),
    featured_image: deferWith(product, (product: SwellRecord) => {
      const image = product.images?.[0];
      return image ? ShopifyImage(image, {}, product) : undefined;
    }),
    featured_media: deferWith(product, (product) => {
      const image = product.images?.[0];
      return image ? ShopifyMedia(image) : undefined;
    }),
    // not used
    first_available_variant: deferWith(product, (product: SwellProduct) => {
      // it returns first variant with empty query
      const variant = getSelectedVariant(product, {});

      return variant
        ? ShopifyVariant(instance, variant, product, depth + 1)
        : undefined;
    }),
    'gift_card?': deferWith(product, isGiftcard),
    handle: defer(() => product.slug),
    // indicates that product has any options
    has_only_default_variant: deferWith(
      product,
      (product) => !product.options?.length,
    ),
    id: defer(() => product.id),
    images: deferWith(product, (product: SwellRecord) => {
      if (!Array.isArray(product.images)) {
        return [];
      }

      return product.images.map((image: SwellData, index) =>
        ShopifyImage(image, { position: index + 1 }, product),
      );
    }),
    media: deferWith(product, (product) => {
      if (!Array.isArray(product.images)) {
        return [];
      }

      return product.images.map((image: SwellData, index) =>
        ShopifyMedia(image, { media_type: 'image', position: index + 1 }),
      );
    }),
    metafields: {},
    options: deferWith(product, (product: SwellProduct): string[] => {
      adjustProduct(instance, product);

      if (!Array.isArray(product.options)) {
        return [];
      }

      return product.options
        .filter((option: SwellProductOption) =>
          isOptionAvailable(product, option),
        )
        .map((option: SwellData) => option.name);
    }),
    options_by_name: deferWith(product, (product: SwellProduct) => {
      adjustProduct(instance, product);

      if (!Array.isArray(product.options)) {
        return {};
      }

      const { queryParams } = instance.swell;
      const variants = getAvailableVariants(product);
      const variant = getSelectedVariant(product, queryParams);

      return product.options.reduce(
        (
          acc: Record<string, ShopifyProductOption | undefined>,
          option: SwellProductOption,
          index: number,
        ) => {
          if (!isOptionAvailable(product, option)) {
            return acc;
          }

          acc[option.name.toLowerCase()] = getOption(
            option,
            index,
            product,
            instance,
            depth,
            variants,
            variant,
          );

          return acc;
        },
        {},
      );
    }),
    options_with_values: deferWith<ShopifyProductOption[], SwellProduct>(
      product,
      (product: SwellProduct) => {
        adjustProduct(instance, product);

        if (!Array.isArray(product.options)) {
          return [];
        }

        const { queryParams } = instance.swell;
        const variants = getAvailableVariants(product);
        const variant = getSelectedVariant(product, queryParams);

        return product.options
          .filter((option) => isOptionAvailable(product, option))
          .map((option: SwellProductOption, index: number) =>
            getOption(
              option,
              index,
              product,
              instance,
              depth,
              variants,
              variant,
            ),
          );
      },
    ),
    price: deferWith(product, (product) =>
      instance.toShopifyPrice(product.price),
    ),
    price_max: deferWith<number, SwellRecord>(product, (product) => {
      if (!Array.isArray(product.variants?.results)) {
        return instance.toShopifyPrice(product.price);
      }

      const max = product.variants.results.reduce(
        (max: number, variant: SwellRecord) => Math.max(max, variant.price),
        0,
      );

      return instance.toShopifyPrice(max);
    }),
    price_min: deferWith<number, SwellRecord>(product, (product) => {
      if (!Array.isArray(product.variants?.results)) {
        return instance.toShopifyPrice(product.price);
      }

      const min = product.variants.results.reduce(
        (min: number, variant: SwellRecord) => Math.min(min, variant.price),
        Infinity,
      );

      return instance.toShopifyPrice(min);
    }),
    price_varies: deferWith<boolean, SwellRecord>(product, (product) => {
      if (!Array.isArray(product.variants?.results)) {
        return false;
      }

      return product.variants.results.some(
        (variant: SwellRecord) => variant.price !== product.price,
      );
    }),
    published_at: deferWith(
      product,
      (product) => product.date_updated || product.date_created,
    ),
    'quantity_price_breaks_configured?': deferWith(
      product,
      (product) => product.prices?.length > 0,
    ),
    // ShopifyProduct does not have this property
    // @ts-expect-error property
    quantity_rule: deferWith(product, (product) => {
      let inventory = product.stock_level || 0;
      if (inventory < 0) {
        inventory = 0;
      }
      const max = !product.stock_status ? null : inventory;
      return { min: 1, max, increment: 1 };
    }),
    inventory_quantity: deferWith(product, (product) => {
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
    selected_or_first_available_selling_plan_allocation: undefined,
    selected_or_first_available_variant: deferWith(
      product,
      (product: SwellProduct) => {
        adjustProduct(instance, product);

        const variant = getSelectedVariant(product, instance.swell.queryParams);

        return variant
          ? ShopifyVariant(instance, variant, product, depth + 1)
          : undefined;
      },
    ),
    selected_selling_plan: undefined,
    selected_variant: undefined,
    selling_plan_groups: [],
    tags: defer(() => product.tags),
    template_suffix: defer(() => product.theme_template),
    title: defer(() => product.name),
    type: defer(() => product.type),
    url: deferWith(product, (product) => `/products/${product.slug}`), // TODO: pass theme settings to get this correctly
    variants: deferWith(product, (product: SwellProduct) => {
      adjustProduct(instance, product);

      if (!Array.isArray(product.variants?.results)) {
        return [];
      }

      // Note variants must be in the same order as options
      const variants = product.variants.results
        .map((variant: SwellRecord) =>
          ShopifyVariant(instance, variant, product, depth + 1),
        )
        .reverse();

      return variants;
    }),
    variants_count: deferWith(product, (product: SwellProduct) => {
      adjustProduct(instance, product);

      return product.variants?.count || 0;
    }),
    vendor: undefined,
  });
}

export function ShopifyProductOptionValue(values: ShopifyProductOptionValue) {
  return new ShopifyResource<ShopifyProductOptionValue>(values, 'name');
}

export function isLikeShopifyProduct(value: unknown): value is ShopifyProduct {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, 'variants') &&
    Object.hasOwn(value, 'gift_card?') &&
    Object.hasOwn(value, 'price_varies') &&
    Object.hasOwn(value, 'has_only_default_variant')
  );
}

function getOption(
  option: SwellProductOption,
  index: number,
  product: SwellProduct,
  instance: ShopifyCompatibility,
  depth: number,
  variants?: SwellVariant[],
  variant?: SwellVariant,
) {
  const { queryParams } = instance.swell;

  return {
    ...option,
    name: option.name,
    position: index + 1,
    selected_value: undefined,
    values: option.values?.map((value: SwellProductOptionValue) =>
      ShopifyProductOptionValue({
        ...value,
        available: isOptionValueAvailable(option, value, product, variants),
        id: value.id as unknown as number,
        name: value.name,
        product_url: undefined,
        selected: isOptionValueSelected(
          option,
          value,
          product,
          queryParams,
          variant,
        ),
        swatch: undefined,
        variant: ShopifyVariant(
          instance,
          variant || product,
          product,
          depth + 1,
        ),
      }),
    ),
  };
}

function adjustProduct(instance: ShopifyCompatibility, product: SwellProduct) {
  adjustProductVariants(instance, product);
}

function adjustProductVariants(
  instance: ShopifyCompatibility,
  product: SwellProduct,
) {
  // If Swell variants are supported directly, no adjustment is needed
  if (instance.supportsSwellVariants()) {
    return;
  }

  const hasVariants =
    Array.isArray(product.variants?.results) &&
    product.variants.results.length > 0;

  if (hasVariants) {
    // Product already has variants, nothing to adjust
    return;
  }

  // Shopify requires every product to have at least one variant.
  // If missing, create a default "Title / Default Title" variant.
  const optionName = 'Title';
  const valueName = 'Default Title';
  const defaultShopifyOptionValueId = 'default_option_value_id';

  product.options = [
    {
      active: true,
      variant: true,
      name: optionName,
      input_type: 'select',
      values: [{ id: defaultShopifyOptionValueId, name: valueName }],
    },
  ];

  product.variants = {
    page: 1,
    count: 1,
    page_count: 1,
    limit: 1000,
    results: [
      {
        id: product.id,
        name: valueName,
        price: product.price,
        option_value_ids: [defaultShopifyOptionValueId],
        selected_option_values: [defaultShopifyOptionValueId],
      },
    ],
  };
}
