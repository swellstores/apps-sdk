import { ShopifyResource, deferWith } from './resource';
import ShopifyImage from './image';
import ShopifyProduct from './product';
import ShopifyVariant from './variant';

import type { StorefrontResource } from '@/resources';
import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type {
  ShopifyLineItem,
  ShopifySellingPlanAllocation,
} from 'types/shopify';

export default function ShopifyLineItem(
  instance: ShopifyCompatibility,
  item: StorefrontResource | SwellRecord,
  cart: StorefrontResource | SwellRecord,
  options: SwellData = {},
): ShopifyResource<ShopifyLineItem> {
  if (item instanceof ShopifyResource) {
    return item.clone() as ShopifyResource<ShopifyLineItem>;
  }

  return new ShopifyResource<ShopifyLineItem>({
    ...item,
    discount_allocations: item.discounts?.map((discount: any) => {
      const cartDiscount = cart.discounts?.find(
        (cartDiscount: any) => cartDiscount.id === discount.id,
      );

      const discountSourceName =
        (cartDiscount?.source_id === cart.coupon_id
          ? cart.coupon?.name
          : cart.promotions?.results?.find(
              (promo: any) => cartDiscount?.source_id === promo.id,
            )?.name) || cartDiscount?.source_id;

      return [
        {
          amount: discount.amount,
          discount_application: cartDiscount && {
            target_selection:
              cartDiscount.type === 'order'
                ? 'all'
                : ['shipment', 'product'].includes(cartDiscount.type)
                  ? 'entitled'
                  : 'explicit',
            target_type:
              cartDiscount.type === 'shipment' ? 'shipping_line' : 'line_item',
            title: discountSourceName,
            total_allocated_amount: cartDiscount.amount,
            type:
              cartDiscount.type === 'promo'
                ? 'automatic'
                : cartDiscount.type === 'coupon'
                  ? 'discount_code'
                  : 'manual',
            value:
              cartDiscount.rule?.value_type === 'fixed'
                ? cartDiscount.rule?.value_fixed
                : cartDiscount.rule?.value_percent,
            value_type:
              cartDiscount.rule?.value_type === 'fixed'
                ? 'fixed_amount'
                : 'percentage',
          },
        },
      ];
    }),
    error_message: undefined, // N/A
    final_line_price: isTrialSubscriptionItem(item)
      ? 0
      : item.price_total - item.discount_total,
    final_price: isTrialSubscriptionItem(item)
      ? 0
      : item.price - item.discount_each,
    // May not want to support this
    /* fulfillment: options.order
      ? deferWith(cart, async (cart: any) => {
          return await resolveFulfillment(instance, cart, item);
        })
      : undefined, */
    fulfillment_service: 'manual', // TODO
    gift_card: item.delivery === 'giftcard',
    grams: item.shipment_weight,
    id: item.id,
    image: deferWith(
      [item.product, item.variant],
      (product: SwellRecord, variant: SwellRecord) => {
        const image = product?.images?.[0];
        return image
          ? ShopifyImage(instance, image, {}, product, variant)
          : undefined;
      },
    ),
    item_components: item.bundle_items?.map((bundleItem: any) =>
      ShopifyLineItem(instance, bundleItem, cart, { ...options, bundle: true }),
    ),
    key: item.id, // Good enough
    line_level_discount_allocations: [], // TODO
    line_level_total_discount: item.discount_total, // TODO should be line discount only
    message: undefined, // N/A
    options_with_values: item.options,
    original_line_price: isTrialSubscriptionItem(item)
      ? 0
      : item.price * item.quantity,
    original_price: isTrialSubscriptionItem(item) ? 0 : item.price,
    product: deferWith(
      item.product,
      () => item.product && ShopifyProduct(instance, item.product),
    ),
    product_id: item.product_id,
    properties: item.metadata,
    quantity: item.quantity,
    requires_shipping: item.delivery === 'shipment',
    selling_plan_allocation: resolveSubscription(item),
    sku: deferWith(item.product, (product: any) => product.sku),
    successfully_fulfilled_quantity: item.quantity_delivered,
    tax_lines: item.taxes?.map((tax: any) => {
      const cartTax = cart.taxes?.find((cartTax: any) => cartTax.id === tax.id);
      return {
        price: tax.amount,
        rate: (cartTax?.rate || 0) / 100,
        rate_percentage: cartTax?.rate || 0,
        title: tax.name,
      };
    }),
    taxable: item.tax_total > 0,
    title: deferWith(
      [item.product, item.variant],
      (product, variant) =>
        `${product?.name || item.product_id}${
          variant?.name ? ` - ${variant.name}` : ''
        }`,
    ),
    // unit_price // only available in germany and france
    // unit_price_measurement // only available in germany and france
    url: deferWith(item.product, (product) => `/products/${product.slug}`), // TODO: use page mapping
    url_to_remove: '', // TODO
    variant: deferWith([item.product, item.variant], () => {
      let { variant } = item;

      if (!variant) {
        variant = item.product;
      }

      return ShopifyVariant(instance, variant, item.product);
    }),
    vendor: undefined,
    discounts: [], // Deprecated by Shopify
    line_price: item.price_total,
    price: item.price,
    total_discount: item.discount_total,
  });
}

export function countItemQuantity(
  items: SwellData[],
  quantityField = 'quantity',
) {
  return items?.reduce((sum, item) => sum + item[quantityField], 0) || 0;
}

async function resolveFulfillment(
  instance: ShopifyCompatibility,
  order: SwellData,
  item: SwellData,
) {
  const shipments = await instance.swell.getCachedResource(
    `shipments-${order.id}`,
    [],
    async () => {
      return (
        // Note: this does not work with the current Swell API
        (
          await (instance.swell.storefront.account as any).getOrder(order.id, {
            include: {
              url: '/shipments',
              data: {
                limit: 10,
                canceled: { $ne: true },
              },
            },
          })
        )?.shipments?.results
      );
    },
  );

  if (!shipments) {
    return null;
  }

  const trackingNumbers: string[] = [];
  const shippedLineItems: any = [];
  let carrierName;

  for (const shipment of shipments || []) {
    for (const shippedItem of shipment.items || []) {
      const orderItem = order.items?.find(
        (item: any) => item.id === shippedItem.order_item_id,
      );

      if (orderItem) {
        if (shippedItem.bundle_item_id) {
          const orderBundleItem = orderItem.bundle_items?.find(
            (bundleItem: any) => bundleItem.id === shippedItem.bundle_item_id,
          );
          if (orderBundleItem) {
            shippedLineItems.push(orderBundleItem);
          }
        } else {
          shippedLineItems.push(orderItem);
        }

        if (
          shipment.tracking_code &&
          !trackingNumbers.includes(shipment.tracking_code)
        ) {
          trackingNumbers.push(shipment.tracking_code);

          if (!carrierName) {
            carrierName = shipment.carrier_name || shipment.carrier;
          }
        }
      }
    }
  }

  if (shippedLineItems.length === 0) {
    return null;
  }

  return new ShopifyResource({
    created_at: shipments[0].date_created,
    fulfillment_line_items: shippedLineItems.map((lineItem: SwellRecord) =>
      ShopifyLineItem(instance, lineItem, order as SwellRecord),
    ),
    item_count: countItemQuantity(shippedLineItems),
    tracking_company: carrierName,
    tracking_number: trackingNumbers[0],
    tracking_numbers: trackingNumbers,
    tracking_url: '', // TODO
  });
}

function isTrialSubscriptionItem(item: StorefrontResource | SwellRecord) {
  const purchaseOption = item?.purchase_option;
  if (purchaseOption?.type !== 'subscription') {
    return false;
  }

  return purchaseOption.billing_schedule.trial_days > 0;
}

function resolveSubscription(
  item: StorefrontResource | SwellRecord,
): ShopifySellingPlanAllocation | undefined {
  const purchaseOption = item?.purchase_option;
  if (purchaseOption?.type !== 'subscription') {
    return undefined;
  }

  const trialDays = purchaseOption.billing_schedule?.trial_days || 0;
  const trialText =
    trialDays > 0
      ? ` (Includes ${trialDays} trial day${trialDays === 1 ? '' : 's'})`
      : '';

  const intervalCount = purchaseOption.billing_schedule?.interval_count || 1;
  let intervalText = 'day';
  switch (purchaseOption.billing_schedule?.interval) {
    case 'weekly':
      intervalText = 'wk';
      break;
    case 'monthly':
      intervalText = 'mo';
      break;
    case 'yearly':
      intervalText = 'yr';
      break;
    default:
  }

  const periodText = `${intervalCount > 1 ? intervalCount : ''}${intervalText}`;
  const text = `${periodText}${trialText}`;

  return {
    checkout_charge_amount: item.price,
    compare_at_price: item.price,
    per_delivery_price: item.price,
    price: item.price,
    price_adjustments: [],
    remaining_balance_charge_amount: 0,
    selling_plan_group_id: purchaseOption.plan_id,
    selling_plan: {
      id: 0,
      group_id: purchaseOption.plan_id,
      name: purchaseOption.plan_name,
      description: purchaseOption.plan_description,
      // billing_schedule: purchaseOption.billing_schedule,
      options: [],
      // provide as separate parts to properly render currency
      // planPriceText: text,
      checkout_charge: { value: item.price, value_type: 'price' },
      recurring_deliveries: item.delivery === 'shipment',
      price_adjustments: [],
      selected: false,
    },
    unit_price: undefined,
  };
}
