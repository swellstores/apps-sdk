import { StorefrontResource } from '../../resources';

import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyLineItem, { countItemQuantity } from './line_item';
import ShopifyAddress from './address';
import ShopifyCustomer from './customer';

import type { SwellData, SwellRecord } from 'types/swell';

export default function ShopifyOrder(
  instance: ShopifyCompatibility,
  order: StorefrontResource | SwellRecord,
  account?: StorefrontResource | SwellRecord,
): ShopifyResource {
  if (order instanceof ShopifyResource) {
    return order.clone();
  }

  const customerAccount = account || order.account;

  const lineItems = deferWith(order, (order: any) =>
    order.items?.map((item: any) =>
      ShopifyLineItem(instance, item, order, { order: true }),
    ),
  );

  return new ShopifyResource({
    attributes: defer(() => order.metadata),
    billing_address: deferWith(order, () =>
      ShopifyAddress(instance, order.billing),
    ),
    cancelled: defer(() => order.canceled),
    cancelled_at: defer(() => order.date_canceled),
    confirmation_number: defer(() => order.number),
    created_at: defer(() => order.date_created),
    customer:
      customerAccount &&
      defer(() => ShopifyCustomer(instance, customerAccount)),
    customer_order_url: deferWith(
      order,
      (order: any) => `/account/orders/${order.id}`,
    ),
    customer_url: deferWith(
      order,
      (order: any) => `/account/orders/${order.id}`,
    ),
    email:
      customerAccount &&
      deferWith(customerAccount, (account: any) => account.email),
    financial_status: deferWith(order, (order: any) =>
      shopifyFinancialStatus(order),
    ),
    financial_status_label: deferWith(order, (order: any) =>
      shopifyFinancialStatusLabel(order),
    ),
    fulfillment_status: deferWith(order, (order: any) =>
      shopifyFulfillmentStatus(order),
    ),
    fulfillment_status_label: deferWith(order, (order: any) =>
      shopifyFulfillmentStatusLabel(order),
    ),
    id: deferWith(order, (order: any) => order.id),
    item_count: deferWith(order, (order: any) =>
      countItemQuantity(order.items),
    ),
    line_items: lineItems,
    line_items_subtotal_price: defer(() => order.sub_total),
    name: defer(() => order.number),
    number: deferWith(order, (order: any) => order.number),
    note: defer(() => order.comments),
    phone:
      customerAccount &&
      deferWith(
        [order, customerAccount],
        (order: any, account: any) =>
          order.billing?.phone || order.shipping.phone || account.phone,
      ),
    shipping_address: deferWith(order, () =>
      ShopifyAddress(instance, order.shipping),
    ),
    shipping_methods: defer(() => {
      const shippingMethod = ShopifyShippingMethod(order);
      return shippingMethod && [shippingMethod];
    }),
    shipping_price: defer(() => order.shipment_total),
    subtotal_line_items: lineItems,
    subtotal_price: defer(() => order.sub_total),
    tags: null, // N/A
    tax_price: defer(() => order.tax_total),
    total_discounts: defer(() => order.discount_total),
    total_net_amount: defer(() => order.grand_total),
    total_price: defer(() => order.grand_total),
    total_refunded_amount: defer(() => order.refund_total),

    // TODO
    // cancel_reason
    // cancel_reason_label
    // cart_level_discount_applications
    // discount_applications
    // order_status_url
    // 'pickup_in_store?'
    // tax_lines
    // total_duties
    // transactions
  });
}

export function shopifyFinancialStatus(order: any) {
  if (refundDue(order)) {
    return 'refund_due';
  }
  if (
    order.payment_total > 0 &&
    order.payment_total > order.refund_total &&
    order.payment_total < order.grand_total &&
    paymentDue(order) > 0
  ) {
    return 'partially_paid';
  }
  if (order.refund_total > 0 && order.refund_total < order.payment_total) {
    return 'partially_refunded';
  }
  if (order.refund_total > 0 && order.refund_total === order.payment_total) {
    return 'refunded';
  }
  if (order.payment_total > 0 && order.payment_balance === 0) {
    return 'paid';
  }
  if (order.authorized_payment_id && !order.paid) {
    return 'authorized';
  }
  if (order.grand_total > 0) {
    return 'unpaid';
  }

  // TODO: expired, voided, pending
  return 'complete';
}

export function shopifyFulfillmentStatus(order: any) {
  // TODO: figure out what the options are on shopify, they're not documented
  if (order.canceled) {
    return 'canceled';
  }

  if (order.hold || order.status === 'hold') {
    return 'on_hold';
  }

  if (order.delivered) {
    if (order.item_quantity_returned > 0 || order.return_total > 0) {
      if (order.item_quantity_returned === order.item_quantity) {
        return 'returned';
      }

      return 'rartially_returned';
    }

    return 'fulfilled';
  }

  if (order.item_quantity_delivered > 0) {
    return 'partially_fulfilled';
  }

  if (order.item_quantity_deliverable > 0) {
    return 'unfulfilled';
  }

  return 'complete';
}

export function shopifyFinancialStatusLabel(order: any) {
  // TODO: localization
  return statusToLabel(shopifyFinancialStatus(order));
}

export function shopifyFulfillmentStatusLabel(order: any) {
  // TODO: localization
  return statusToLabel(shopifyFulfillmentStatus(order));
}

function statusToLabel(status: string) {
  const label = status.replace(/\_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function paymentDue(order: any) {
  if (!order.canceled && order.payment_balance < 0) {
    return -order.payment_balance;
  }

  return 0;
}

export function refundDue(order: any) {
  if (order.canceled) {
    return order.payment_total - order.refund_total;
  }
  if (order.payment_balance > 0) {
    return order.payment_balance;
  }
}

function ShopifyShippingMethod(order: SwellData): ShopifyResource | null {
  if (!order.shipping?.service) {
    return null;
  }
  return new ShopifyResource({
    id: order.shipping.service,
    handle: `${order.shipping.service}-${order.shipping.price}`,
    original_price: order.shipment_price,
    price: order.shipment_total,
    tax_lines: [], // N/A
    title: order.shipping.service_name || order.shipping.service,
  });
}
