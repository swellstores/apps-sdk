import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyVariant from './variant';
import ShopifyImage from './image';
import ShopifyMedia from './media';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type {
  ShopifyProduct,
  ShopifyProductOption,
  ShopifyProductOptionValue,
} from 'types/shopify';
import type {
  SwellStorefrontProduct,
  SwellStorefrontVariant,
} from 'types/swell_product';
import {
  calculateAddOptionsPrice,
  getSelectedOptionValues,
  getSelectedVariant,
} from './product_functions';

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

  return new ShopifyResource<ShopifyProduct>(
    getShopifyProductProps(
      instance,
      product as unknown as SwellStorefrontProduct,
      depth,
    ),
  );
}

export function ShopifyProductOptionValue(values: ShopifyProductOptionValue) {
  return new ShopifyResource<ShopifyProductOptionValue>(values, 'name');
}

export function getShopifyProductProps(
  instance: ShopifyCompatibility,
  product: SwellStorefrontProduct,
  depth: number = 0,
) {
  const compareAtPrice = defer<number>(() => product.orig_price);

  return {
    available: deferWith(
      product,
      (product) => product.stock_status === 'in_stock' || !product.stock_status,
    ),
    category: '',
    collections: [], // TODO: need to support this in the resource class somehow
    compare_at_price: compareAtPrice, // Note: This field hasn't been standardized as of May 2024
    compare_at_price_max: compareAtPrice,
    compare_at_price_min: compareAtPrice,
    compare_at_price_varies: false,
    content: defer(() => product.description),
    created_at: defer(() => product.date_created),
    description: defer(() => product.description),
    featured_image: deferWith(product, (product: SwellRecord) => {
      const image = product.images?.[0];
      return image ? ShopifyImage(instance, image, {}, product) : undefined;
    }),
    featured_media: deferWith(product, (product) => {
      const image = product.images?.[0];
      return image ? ShopifyMedia(instance, image) : undefined;
    }),
    // not used
    first_available_variant: deferWith(
      product,
      (product: SwellStorefrontProduct) => {
        // it returns first variant with empty query
        const variant = getSelectedVariant(product, {});
        return ShopifyVariant(instance, variant || product, product, depth + 1);
      },
    ),
    'gift_card?': deferWith(product, (product) => product.type === 'giftcard'),
    handle: defer(() => product.slug),
    // indicates that product has any options
    has_only_default_variant: deferWith(
      product,
      (product) => !product.options?.length,
    ),
    // TODO we use string ids
    id: defer(() => product.id as unknown as number),
    images: deferWith(product, (product: SwellRecord) => {
      if (!Array.isArray(product.images)) {
        return [];
      }

      return product.images.map((image: SwellData, index) =>
        ShopifyImage(instance, image, { position: index + 1 }, product),
      );
    }),
    media: deferWith(product, (product) => {
      if (!Array.isArray(product.images)) {
        return [];
      }

      return product.images.map((image: SwellData, index) =>
        ShopifyMedia(instance, image, {
          media_type: 'image',
          position: index + 1,
        }),
      );
    }),
    metafields: {},
    options: deferWith(product, (product): string[] => {
      if (!Array.isArray(product.options)) {
        return [];
      }

      return product.options
        .filter((option: SwellData) => option.active && option.name)
        .map((option: SwellData) => option.name);
    }),
    // all options values including non-variant
    selected_option_values: deferWith(
      product,
      (product: SwellStorefrontProduct) =>
        getSelectedOptionValues(product, instance.swell.queryParams),
    ),
    options_by_name: deferWith(product, (product) => {
      if (!Array.isArray(product.options)) {
        return {};
      }

      let index = 0;

      return product.options.reduce(
        (
          acc: Record<string, ShopifyProductOption | undefined>,
          option: any,
        ) => {
          if (option.active && option.name) {
            acc[option.name.toLowerCase()] = {
              name: option.name,
              position: ++index,
              selected_value: undefined,
              // variant_option: option.variant,
              values:
                option.values?.map((value: any) =>
                  ShopifyProductOptionValue({
                    available: true,
                    id: value.id,
                    name: value.name,
                    product_url: undefined,
                    selected: false,
                    swatch: undefined,
                    variant: undefined,
                    // addPrice: value.price,
                  }),
                ) ?? [],
            };
          }

          return acc;
        },
        {},
      );
    }),
    options_with_values: deferWith<
      ShopifyProductOption[],
      SwellStorefrontProduct
    >(product, (product: SwellStorefrontProduct) => {
      if (!Array.isArray(product.options)) {
        return [];
      }

      const variant = getSelectedVariant(product, instance.swell.queryParams);
      const optionValues = variant?.option_value_ids || [];

      return product.options
        .filter((option) => option.active && option.name)
        .map((option: any, index: number) => {
          return {
            name: option.name,
            position: index + 1,
            selected_value: undefined,
            // variant_option: option.variant,
            values: option.values?.map((value: any) =>
              ShopifyProductOptionValue({
                available: true,
                id: value.id,
                name: value.name,
                product_url: undefined,
                selected: optionValues.includes(value.id),
                swatch: undefined,
                variant: ShopifyVariant(
                  instance,
                  variant || product,
                  product,
                  depth + 1,
                ),
                // addPrice: value.price,
              }),
            ),
          };
        });
    }),
    price: deferWith(product, (product: SwellStorefrontProduct) =>
      calculateAddOptionsPrice(product, instance.swell.queryParams),
    ),
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
    published_at: deferWith(
      product,
      (product) => product.date_updated || product.date_created,
    ),
    'quantity_price_breaks_configured?': deferWith(
      product,
      (product) => product.prices?.length > 0,
    ),
    quantity_rule: deferWith(product, (product) => {
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
      (product: SwellStorefrontProduct) => {
        const variant =
          getSelectedVariant(product, instance.swell.queryParams) || product;

        return ShopifyVariant(instance, variant, product, depth + 1);
      },
    ),
    selected_selling_plan: undefined,
    selected_variant: undefined,
    selling_plan_groups: [],
    tags: defer(() => product.tags),
    template_suffix: undefined,
    title: defer(() => product.name),
    type: defer(() => product.type),
    url: deferWith(product, (product) => `/products/${product.slug}`), // TODO: pass theme settings to get this correctly
    variants: deferWith(product, (product: SwellRecord) => {
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
    variants_count: deferWith(product, (product: SwellRecord) => {
      return product.variants?.count || 0;
    }),
    vendor: undefined,
  };
}
