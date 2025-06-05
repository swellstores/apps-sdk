import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import {
  type DeferredShopifyResource,
  ShopifyResource,
  deferWith,
  defer,
} from './resource';
import ShopifyProduct from './product';
import ShopifyMedia from './media';
import ShopifyImage from './image';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';
import type {
  ShopifyProductOptionValue,
  ShopifyQuantityPriceBreak,
  ShopifyVariant,
} from 'types/shopify';
import type {
  SwellStorefrontProduct,
  SwellStorefrontVariant,
} from 'types/swell_product';

export default function ShopifyVariant(
  instance: ShopifyCompatibility,
  variant: StorefrontResource | SwellRecord,
  productIn?: StorefrontResource | SwellRecord,
  depth: number = 0,
): ShopifyResource<ShopifyVariant> {
  if (variant instanceof ShopifyResource) {
    return variant.clone() as ShopifyResource<ShopifyVariant>;
  }

  if (variant instanceof StorefrontResource) {
    variant = cloneStorefrontResource(variant);
  }

  const product = productIn || variant.product || {};

  return new ShopifyResource<ShopifyVariant>(
    getShopifyVariantProps(
      instance,
      variant as unknown as SwellStorefrontVariant,
      product as unknown as SwellStorefrontProduct,
      ShopifyProduct,
      depth,
    ),
  );
}

export function getShopifyVariantProps(
  instance: ShopifyCompatibility,
  variant: SwellStorefrontVariant,
  product: SwellStorefrontProduct,
  productTypeConvertor: (
    instance: ShopifyCompatibility,
    product: any,
    depth: number,
  ) => ShopifyResource<any>,
  depth: number = 0,
) {
  return {
    available: deferWith(variant, (variant) =>
      Boolean(variant.stock_status === 'in_stock' || !variant.stock_status),
    ),
    barcode: undefined,
    compare_at_price: defer<number>(() => variant.orig_price),
    featured_image: deferWith(
      [product, variant],
      (product: SwellStorefrontProduct, variant) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image
          ? ShopifyImage(instance, image, {}, product, variant)
          : undefined;
      },
    ),
    featured_media: deferWith(
      [product, variant],
      (product: SwellStorefrontProduct, variant) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image
          ? ShopifyMedia(instance, image, { media_type: 'image' })
          : undefined;
      },
    ),
    // TODO we use string ids
    id: defer(() => variant.id as unknown as number),
    image: deferWith(
      [product, variant],
      (product: SwellStorefrontProduct, variant) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image
          ? ShopifyImage(instance, image, {}, product, variant)
          : undefined;
      },
    ),
    incoming: false,
    inventory_management: undefined,
    inventory_policy: deferWith(product, (product) =>
      product.stock_tracking ? 'deny' : 'continue',
    ),
    inventory_quantity: deferWith(
      variant,
      (variant: SwellStorefrontVariant) => {
        if (!variant.stock_status) {
          return Infinity;
        }

        let inventory = variant.stock_level || 0;
        if (inventory < 0) {
          inventory = 0;
        }
        return inventory;
      },
    ),
    matched: false,
    metafields: {},
    next_incoming_date: undefined,
    options: getOptions(product, variant),
    option1: getOptionByIndex(product, variant, 0), // Deprecated by Shopify
    option2: getOptionByIndex(product, variant, 1), // Deprecated by Shopify
    option3: getOptionByIndex(product, variant, 2), // Deprecated by Shopify
    price: deferWith(
      [product, variant],
      (product: SwellStorefrontProduct, variant) => {
        let price = product.price;
        if (variant.price !== null && variant.price !== undefined) {
          price = variant.price;
        }

        return price;
      },
    ),
    product: deferWith(product, (product: SwellRecord) => {
      return productTypeConvertor(instance, product, depth + 1);
    }),
    quantity_price_breaks: deferWith(
      variant,
      (variant: SwellStorefrontVariant) => {
        if (!Array.isArray(variant.prices)) {
          return [];
        }

        return variant.prices.reduce(
          (acc: ShopifyQuantityPriceBreak[], item) => {
            if (!item.account_group) {
              acc.push({
                minimum_quantity: item.quantity_min,
                price: item.price,
              });
            }

            return acc;
          },
          [],
        );
      },
    ),
    'quantity_price_breaks_configured?': deferWith(
      variant,
      (variant: SwellStorefrontVariant) => (variant.prices?.length || 0) > 0,
    ),
    quantity_rule: {
      min: 1,
      max: Infinity,
      increment: 1,
    },
    requires_selling_plan: false,
    requires_shipping: deferWith(product, (product) =>
      Boolean(product.delivery?.contains('shipment')),
    ),
    selected: false,
    selected_selling_plan_allocation: undefined,
    selling_plan_allocations: [],
    sku: defer(() => variant.sku),
    store_availabilities: [],
    taxable: true,
    title: defer<string>(() => variant.name),
    unit_price: defer(() => variant.price),
    unit_price_measurement: undefined,
    url: defer<string>(() => product.url),
    weight: defer(() => variant.weight),
    // TODO
    weight_in_unit: defer(() => variant.weight_unit as unknown as number),
    weight_unit: defer(() => variant.weight_unit),
  };
}

function getOptions(
  product: StorefrontResource | SwellRecord,
  variant: StorefrontResource | SwellRecord,
): DeferredShopifyResource<ShopifyProductOptionValue[]> {
  return deferWith([product, variant], (product, variant) => {
    if (
      !Array.isArray(product.options) ||
      !Array.isArray(variant.option_value_ids)
    ) {
      return [];
    }

    const optionValuesById = product.options.reduce((acc: any, option: any) => {
      for (const value of option.values || []) {
        if (!acc[value.id]) {
          acc[value.id] = value.name;
        }
      }
      return acc;
    }, {});

    return variant.option_value_ids
      .map((id: string) => optionValuesById[id])
      .filter(Boolean);
  });
}

// deprecated
function getOptionByIndex(
  product: StorefrontResource | SwellRecord,
  variant: StorefrontResource | SwellRecord,
  index: number,
): DeferredShopifyResource<string | undefined> {
  return deferWith(
    [product, variant],
    (product: SwellRecord, variant: SwellRecord) => {
      const optionValuesById = product.options?.reduce(
        (acc: any, option: any) => {
          for (const value of option.values || []) {
            if (!acc[value.id]) {
              acc[value.id] = value.name;
            }
          }
          return acc;
        },
        {},
      );

      const value = variant.option_value_ids?.[index];

      return value ? optionValuesById[value] : undefined;
    },
  );
}
