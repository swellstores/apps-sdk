import { StorefrontResource } from '../../resources';

import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct, { getSelectedVariantOptionValues } from './product';
import ShopifyMedia from './media';

import type { SwellData, SwellRecord } from 'types/swell';

export default function ShopifyVariant(
  instance: ShopifyCompatibility,
  variant: StorefrontResource | SwellRecord,
  productIn?: StorefrontResource | SwellRecord,
  depth: number = 0,
) {
  if (variant instanceof ShopifyResource) {
    return variant.clone();
  }

  const product = productIn || variant.product || {};

  return new ShopifyResource({
    available: deferWith<any, any>(
      variant,
      (variant) => variant.stock_status === 'in_stock' || !variant.stock_status,
    ),
    barcode: null,
    compare_at_price: defer(() => variant.orig_price),
    featured_image: deferWith<any, any>(
      [product, variant],
      (product, variant) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image && ShopifyMedia(instance, image);
      },
    ),
    featured_media: deferWith<any, any>(
      [product, variant],
      (product, variant) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image && ShopifyMedia(instance, image);
      },
    ),
    id: deferWith(variant, (variant: any) => variant.id),
    image: deferWith([product, variant], (product: any, variant: any) => {
      const image = variant.images?.[0] || product.images?.[0];
      return image && ShopifyMedia(instance, image);
    }),
    incoming: false,
    inventory_management: null,
    inventory_policy: null,
    inventory_quantity: deferWith(variant, (variant: any) => {
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
    metafields: null,
    next_incoming_date: null,
    options: getOptions(product, variant),
    selected_option_values: deferWith(
      [product, variant],
      (product: any, variant: any) =>
        getSelectedVariantOptionValues(
          product,
          variant,
          instance.swell.queryParams,
        ),
    ),
    option1: getOptionByIndex(product, variant, 0), // Deprecated by Shopify
    option2: getOptionByIndex(product, variant, 1), // Deprecated by Shopify
    option3: getOptionByIndex(product, variant, 2), // Deprecated by Shopify
    price: deferWith([product, variant], (product: any, variant: any) =>
      getVariantPrice(product, variant, instance.swell.queryParams),
    ),
    product: deferWith(product, (product: any) => {
      return ShopifyProduct(instance, product, depth + 1);
    }),
    quantity_price_breaks: null,
    'quantity_price_breaks_configured?': deferWith(
      variant,
      () => variant.prices?.length > 0,
    ),
    quantity_rule: {
      min: 1,
      max: null,
      increment: 1,
    },
    requires_selling_plan: false,
    requires_shipping: deferWith(product, () =>
      product.delivery?.contains('shipment'),
    ),
    selected: false,
    selected_selling_plan_allocation: null,
    selling_plan_allocations: null,
    sku: deferWith(variant, (variant: any) => variant.sku),
    store_availabilities: null,
    taxable: true,
    title: defer(() => variant.name),
    unit_price: defer(() => variant.price),
    unit_price_measurement: null,
    url: defer(() => product.url),
    weight: deferWith(variant, (variant: any) => variant.weight),
    weight_in_unit: defer(() => variant.weight_unit),
    weight_unit: deferWith(variant, (variant: any) => variant.weight_unit),
  });
}

function getOptions(product: any, variant: any) {
  return deferWith([product, variant], (product: any, variant: any) => {
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
    return variant.option_value_ids
      ?.map((id: any) => optionValuesById[id])
      .filter(Boolean);
  });
}

// deprecated
function getOptionByIndex(product: any, variant: any, index: number) {
  return deferWith([product, variant], (product: any, variant: any) => {
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
    return (
      variant.option_value_ids?.[index] &&
      optionValuesById[variant.option_value_ids[index]]
    );
  });
}

// calculate additional price from selected non-variant options
function getVariantPrice(product: any, variant: any, queryParams: SwellData) {
  const { option_values: queryOptionValues = '' } = queryParams;
  const optionValues = queryOptionValues.split(',');

  const addPrice = product.options?.reduce((acc: any, option: any) => {
    if (
      option.variant || // skip variant options
      !option.active ||
      !option.values ||
      option.values.length <= 0
    ) {
      return acc;
    }

    if (option.input_type !== 'select') {
      return acc;
    }

    // only non-variant options
    for (const value of option.values) {
      if (optionValues.includes(value.id)) {
        return acc + (value.price || 0);
      }
    }

    return acc + (option.values[0].price || 0);
  }, 0);

  let price = product.price;
  if (variant.price !== null && variant.price !== undefined) {
    price = variant.price;
  }

  return price + (addPrice || 0);
}
