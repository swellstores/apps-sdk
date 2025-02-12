import { StorefrontResource } from '../../resources';

import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource, deferWith } from './resource';
import ShopifyImage from './image';
import ShopifyProduct from './product';
import ShopifyVariant from './variant';

import type { SwellData, SwellRecord } from 'types/swell';

export default function ShopifyLineItem(
  instance: ShopifyCompatibility,
  item: StorefrontResource | SwellRecord,
  cart: StorefrontResource | SwellRecord,
  options: SwellData = {},
) {
  return new ShopifyResource({
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
    error_message: null, // N/A
    final_line_price: item.price_total - item.discount_total,
    final_price: item.price - item.discount_each,
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
      (product: any, variant: any) =>
        product?.images?.[0] &&
        ShopifyImage(instance, product.images?.[0], product, variant),
    ),
    item_components: item.bundle_items?.map((bundleItem: any) =>
      ShopifyLineItem(instance, bundleItem, cart, { ...options, bundle: true }),
    ),
    key: item.id, // Good enough
    line_level_discount_allocations: [], // TODO
    line_level_total_discount: item.discount_total, // TODO should be line discount only
    message: null, // N/A
    options_with_values: item.options,
    original_line_price: item.price * item.quantity,
    original_price: item.price,
    product: deferWith(
      item.product,
      () => item.product && ShopifyProduct(instance, item.product),
    ),
    product_id: item.product_id,
    properties: item.metadata,
    quantity: item.quantity,
    requires_shipping: item.delivery === 'shipment',
    selling_plan_allocation: null, // N/A
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
      (product: any, variant: any) =>
        `${product?.name || item.product_id}${
          variant?.name ? ` - ${variant.name}` : ''
        }`,
    ),
    // unit_price // only available in germany and france
    // unit_price_measurement // only available in germany and france
    url: deferWith(item.product, (product: any) => `/products/${product.slug}`), // TODO: use page mapping
    url_to_remove: null, // TODO
    variant: deferWith([item.product, item.variant], () =>
      item.variant
        ? ShopifyVariant(instance, item.variant, item.product)
        : ShopifyProduct(instance, item.product),
    ),
    vendor: null,
    discounts: null, // Deprecated by Shopify
    line_price: item.price_total,
    price: item.price,
    total_discount: item.discount_total,
  });
}

export function countItemQuantity(items: any[], quantityField = 'quantity') {
  return items?.reduce((sum, item) => sum + item[quantityField], 0) || 0;
}

async function resolveFulfillment(
  instance: ShopifyCompatibility,
  order: any,
  item: any,
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
    fulfillment_line_items: shippedLineItems.map((lineItem: any) =>
      ShopifyLineItem(instance, lineItem, order),
    ),
    item_count: countItemQuantity(shippedLineItems),
    tracking_company: carrierName,
    tracking_number: trackingNumbers[0],
    tracking_numbers: trackingNumbers,
    tracking_url: null, // TODO
  });
}
