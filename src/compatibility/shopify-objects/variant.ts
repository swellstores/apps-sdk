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
  ShopifyProduct as ShopifyProductType,
  ShopifyProductOptionValue,
  ShopifyQuantityPriceBreak,
  ShopifyVariant,
} from 'types/shopify';
import type { SwellProduct, SwellVariant } from '@/resources/swell_types';
import { isProductAvailable } from '@/resources/product_helpers';

export default function ShopifyVariant(
  instance: ShopifyCompatibility,
  variant: StorefrontResource | SwellRecord,
  productIn?: StorefrontResource | SwellRecord,
  depth: number = 0,
): ShopifyResource<ShopifyVariant> {
  if (variant instanceof ShopifyResource) {
    return variant.clone() as ShopifyResource<ShopifyVariant>;
  }

  let swellVariant = {};
  if (variant instanceof StorefrontResource) {
    variant = cloneStorefrontResource(variant);
  } else {
    // variant is a resolved object with swell variant properies
    swellVariant = { ...variant };
  }

  const product = productIn || variant.product || {};

  return new ShopifyResource<ShopifyVariant>({
    ...swellVariant,
    available: deferWith([product, variant], (product, variant) =>
      isProductAvailable(product as SwellProduct, variant as SwellVariant),
    ),
    barcode: undefined,
    compare_at_price: defer<number>(() => variant.orig_price),
    featured_image: deferWith(
      [product, variant],
      (product: SwellRecord, variant: SwellRecord) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image
          ? ShopifyImage(instance, image, {}, product, variant)
          : undefined;
      },
    ),
    featured_media: deferWith([product, variant], (product, variant) => {
      const image = variant.images?.[0] || product.images?.[0];
      return image
        ? ShopifyMedia(instance, image, { media_type: 'image' })
        : undefined;
    }),
    id: defer(() => variant.id),
    image: deferWith(
      [product, variant],
      (product: SwellRecord, variant: SwellRecord) => {
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
    inventory_quantity: deferWith(variant, (variant) => {
      if (!variant.stock_status) {
        return Infinity;
      }

      let inventory = variant.stock_level || 0;
      if (inventory < 0) {
        inventory = 0;
      }
      return inventory;
    }),
    matched: false,
    metafields: {},
    next_incoming_date: undefined,
    options: getOptions(product, variant),
    option1: getOptionByIndex(product, variant, 0), // Deprecated by Shopify
    option2: getOptionByIndex(product, variant, 1), // Deprecated by Shopify
    option3: getOptionByIndex(product, variant, 2), // Deprecated by Shopify
    price: deferWith([product, variant], (product, variant) => {
      let price = product.price;
      if (variant.price !== null && variant.price !== undefined) {
        price = variant.price;
      }

      return price;
    }),
    product: deferWith(product, (product: SwellRecord) => {
      return ShopifyProduct(
        instance,
        product,
        depth + 1,
      ) as ShopifyResource<ShopifyProductType>;
    }),
    quantity_price_breaks: deferWith(variant, (variant) => {
      if (!Array.isArray(variant.prices)) {
        return [];
      }

      return variant.prices.reduce((acc: ShopifyQuantityPriceBreak[], item) => {
        if (!item.account_group) {
          acc.push({
            minimum_quantity: item.quantity_min,
            price: item.price,
          });
        }

        return acc;
      }, []);
    }),
    'quantity_price_breaks_configured?': deferWith(
      variant,
      (variant) => variant.prices?.length > 0,
    ),
    quantity_rule: {
      min: 1,
      max: Infinity,
      increment: 1,
    },
    requires_selling_plan: false,
    requires_shipping: deferWith(product, (product) =>
      Boolean(product.delivery?.includes('shipment')),
    ),
    selected: false,
    selected_selling_plan_allocation: undefined,
    selling_plan_allocations: [],
    sku: defer<string>(() => variant.sku),
    store_availabilities: [],
    taxable: true,
    title: defer<string>(() => variant.name),
    unit_price: defer<number>(() => variant.price),
    unit_price_measurement: undefined,
    url: defer<string>(() => product.url),
    weight: defer<number>(() => variant.weight),
    weight_in_unit: defer(() => variant.weight_unit),
    weight_unit: defer(() => variant.weight_unit),
  });
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
