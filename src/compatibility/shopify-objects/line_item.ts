import { StorefrontResource, cloneStorefrontResource } from '@/resources';
import { ShopifyResource, deferWith } from './resource';
import ShopifyImage from './image';
import ShopifyProduct from './product';
import ShopifyVariant from './variant';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type {
  ShopifyDiscount,
  ShopifyDiscountAllocation,
  ShopifyDiscountApplication,
  ShopifyFulfillment,
  ShopifyLineItem,
  ShopifySellingPlanAllocation,
} from 'types/shopify';
import { isGiftcard } from '@/resources/product_helpers';

export default function ShopifyLineItem(
  instance: ShopifyCompatibility,
  item: StorefrontResource | SwellRecord,
  cart: StorefrontResource | SwellRecord,
  options: SwellData = {},
): ShopifyResource<ShopifyLineItem> {
  if (item instanceof ShopifyResource) {
    return item.clone() as ShopifyResource<ShopifyLineItem>;
  }

  let swellItem = {};
  if (item instanceof StorefrontResource) {
    item = cloneStorefrontResource(item);
  } else {
    swellItem = { ...item };
  }

  const discountAllocations = getDiscountAllocations(instance, cart, item);

  return new ShopifyResource<ShopifyLineItem>({
    ...swellItem,
    // Deprecated by Shopify
    discounts: getDeprecatedDiscounts(instance, cart, item),
    discount_allocations: discountAllocations,
    error_message: undefined, // N/A
    final_line_price: isTrialSubscriptionItem(item)
      ? 0
      : instance.toShopifyPrice(item.price_total - item.discount_total),
    final_price: isTrialSubscriptionItem(item)
      ? 0
      : instance.toShopifyPrice(item.price - item.discount_each),
    // May not want to support this
    /* fulfillment: options.order
      ? deferWith(cart, async (cart: any) => {
          return await resolveFulfillment(instance, cart, item);
        })
      : undefined, */
    fulfillment_service: 'manual', // TODO
    gift_card: isGiftcard(item.product),
    grams: item.shipment_weight,
    id: item.id,
    image: deferWith(
      [item.product, item.variant],
      (product: SwellRecord, variant: SwellRecord) => {
        const image = product?.images?.[0];
        return image ? ShopifyImage(image, {}, product, variant) : undefined;
      },
    ),
    item_components: (item.bundle_items ?? []).map((bundleItem: SwellRecord) =>
      ShopifyLineItem(instance, bundleItem, cart, {
        ...options,
        bundle: true,
      }),
    ),
    key: item.id, // Good enough
    line_level_discount_allocations: discountAllocations, // TODO
    line_level_total_discount: instance.toShopifyPrice(item.discount_total), // TODO should be line discount only
    line_price: instance.toShopifyPrice(item.price_total),
    message: undefined, // N/A
    options_with_values: (item.options ?? []).map((option: SwellData) => ({
      name: option.name,
      value: option.value,
    })),
    original_line_price: isTrialSubscriptionItem(item)
      ? 0
      : instance.toShopifyPrice(item.price * item.quantity),
    original_price: isTrialSubscriptionItem(item)
      ? 0
      : instance.toShopifyPrice(item.price),
    price: instance.toShopifyPrice(item.price),
    product: deferWith(
      item.product,
      () => item.product && ShopifyProduct(instance, item.product),
    ),
    product_id: item.product_id,
    properties: item.metadata ?? {},
    quantity: item.quantity,
    requires_shipping: item.delivery === 'shipment',
    selling_plan_allocation: resolveSubscription(item),
    sku: deferWith(item.product, (product) => product.sku),
    successfully_fulfilled_quantity: item.quantity_delivered,
    tax_lines: (item.taxes ?? []).map((tax: SwellData) => {
      const cartTax = cart.taxes?.find(
        (cartTax: SwellData) => cartTax.id === tax.id,
      );
      return {
        price: instance.toShopifyPrice(tax.amount),
        rate: (cartTax?.rate || 0) / 100,
        rate_percentage: cartTax?.rate || 0,
        title: tax.name,
      };
    }),
    taxable: item.tax_total > 0,
    title: deferWith(
      item.product,
      (product) => product?.name || item.product_id,
    ),
    total_discount: instance.toShopifyPrice(item.discount_total),
    unit_price: undefined, // only available in germany and france
    unit_price_measurement: undefined, // only available in germany and france
    url: deferWith(item.product, (product) => `/products/${product.slug}`), // TODO: use page mapping
    url_to_remove: '', // TODO
    variant: deferWith([item.product, item.variant], () => {
      let { variant } = item;

      if (!variant) {
        variant = item.product;
      }

      return ShopifyVariant(instance, variant, item.product);
    }),
    variant_id: deferWith([item.product, item.variant], (product, variant) => {
      return variant?.id || product?.id;
    }),
    vendor: undefined,
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
): Promise<ShopifyResource<ShopifyFulfillment> | undefined> {
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
    return undefined;
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
    return undefined;
  }

  return new ShopifyResource<ShopifyFulfillment>({
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
    return;
  }

  return {
    checkout_charge_amount: item.price,
    compare_at_price: item.price,
    per_delivery_price: item.price,
    price: item.price,
    price_adjustments: [],
    remaining_balance_charge_amount: 0,
    selling_plan_group_id: purchaseOption.plan_id,
    selling_plan: {
      id: purchaseOption.plan_id,
      group_id: purchaseOption.plan_id,
      name: purchaseOption.plan_name,
      description: purchaseOption.plan_description,
      options: [],
      checkout_charge: { value: item.price, value_type: 'price' },
      recurring_deliveries: item.delivery === 'shipment',
      price_adjustments: [],
      selected: false,
    },
    unit_price: undefined,
  };
}

function findCartDiscount(
  cart: StorefrontResource | SwellRecord,
  discountId: string,
): SwellRecord | undefined {
  return cart.discounts?.find(
    (cartDiscount: SwellRecord) => cartDiscount.id === discountId,
  );
}

function getDiscountSourceName(
  cart: StorefrontResource | SwellRecord,
  cartDiscount?: SwellRecord,
): string {
  if (!cartDiscount?.source_id) {
    return '';
  }

  if (cartDiscount.source_id === cart.coupon_id) {
    return cart.coupon?.name || cartDiscount.source_id;
  }

  const promo = cart.promotions?.results?.find(
    (promo: SwellRecord) => cartDiscount.source_id === promo.id,
  );

  return promo?.name || cartDiscount.source_id;
}

function getDiscountAllocations(
  instance: ShopifyCompatibility,
  cart: StorefrontResource | SwellRecord,
  item: StorefrontResource | SwellRecord,
): ShopifyDiscountAllocation[] {
  if (!Array.isArray(item.discounts)) {
    return [];
  }

  return item.discounts.map(
    (discount: SwellRecord): ShopifyDiscountAllocation => {
      const cartDiscount = findCartDiscount(cart, discount.id);
      const discountSourceName = getDiscountSourceName(cart, cartDiscount);

      return {
        amount: instance.toShopifyPrice(discount.amount),
        discount_application: cartDiscount
          ? {
              target_selection:
                cartDiscount.type === 'order'
                  ? 'all'
                  : ['shipment', 'product'].includes(cartDiscount.type)
                    ? 'entitled'
                    : 'explicit',
              target_type:
                cartDiscount.type === 'shipment'
                  ? 'shipping_line'
                  : 'line_item',
              title: discountSourceName,
              total_allocated_amount: instance.toShopifyPrice(
                cartDiscount.amount,
              ),
              type:
                cartDiscount.type === 'promo'
                  ? 'automatic'
                  : cartDiscount.type === 'coupon'
                    ? 'discount_code'
                    : 'manual',
              value:
                cartDiscount.rule?.value_type === 'fixed'
                  ? cartDiscount.rule.value_fixed
                  : cartDiscount.rule?.value_percent,
              value_type:
                cartDiscount.rule?.value_type === 'fixed'
                  ? 'fixed_amount'
                  : 'percentage',
            }
          : ({} as ShopifyDiscountApplication),
      };
    },
  );
}

function getDeprecatedDiscounts(
  instance: ShopifyCompatibility,
  cart: StorefrontResource | SwellRecord,
  item: StorefrontResource | SwellRecord,
): ShopifyDiscount[] {
  if (!Array.isArray(item.discounts)) {
    return [];
  }

  return item.discounts.map((discount: SwellRecord): ShopifyDiscount => {
    const cartDiscount = findCartDiscount(cart, discount.id);
    const discountSourceName = getDiscountSourceName(cart, cartDiscount);

    return {
      amount: instance.toShopifyPrice(discount.amount),
      code: discountSourceName,
      savings: -instance.toShopifyPrice(discount.amount),
      title: discountSourceName,
      total_amount: instance.toShopifyPrice(discount.amount),
      total_savings: -instance.toShopifyPrice(discount.amount),
      type:
        cartDiscount?.type === 'shipment'
          ? 'ShippingDiscount'
          : cartDiscount?.rule?.value_type === 'fixed'
            ? 'FixedAmountDiscount'
            : 'PercentageDiscount',
    };
  });
}
