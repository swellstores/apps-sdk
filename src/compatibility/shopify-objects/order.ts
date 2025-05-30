import { StorefrontResource, cloneStorefrontResource } from '@/resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyLineItem, { countItemQuantity } from './line_item';
import ShopifyAddress from './address';
import ShopifyCustomer from './customer';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type { ShopifyOrder, ShopifyShippingMethod } from 'types/shopify';

export default function ShopifyOrder(
  instance: ShopifyCompatibility,
  order: StorefrontResource | SwellRecord,
  account?: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyOrder> {
  if (order instanceof ShopifyResource) {
    return order.clone() as ShopifyResource<ShopifyOrder>;
  }

  if (order instanceof StorefrontResource) {
    order = cloneStorefrontResource(order);
  }

  const customerAccount = account || order.account;

  const lineItems = deferWith(order, (order: SwellRecord) => {
    if (!Array.isArray(order.items)) {
      return [];
    }

    return order.items.map((item: SwellRecord) =>
      ShopifyLineItem(instance, item, order, { order: true }),
    );
  });

  return new ShopifyResource<ShopifyOrder>({
    attributes: defer(() => order.metadata),
    billing_address: deferWith(order, () =>
      ShopifyAddress(instance, order.billing),
    ),
    cancelled: defer(() => order.canceled),
    cancelled_at: defer(() => order.date_canceled),
    cart_level_discount_applications: [], // TODO
    confirmation_number: defer(() => order.number),
    created_at: defer(() => order.date_created),
    customer:
      customerAccount &&
      defer(() => ShopifyCustomer(instance, customerAccount)),
    customer_order_url: deferWith(
      order,
      (order) => `/account/orders/${order.id}`,
    ),
    customer_url: deferWith(order, (order) => `/account/orders/${order.id}`),
    discounts: [], // TODO
    discount_applications: [], // TODO
    email:
      customerAccount && deferWith(customerAccount, (account) => account.email),
    financial_status: deferWith(order, (order) =>
      shopifyFinancialStatus(order),
    ),
    financial_status_label: deferWith(order, (order) =>
      shopifyFinancialStatusLabel(order),
    ),
    fulfillment_status: deferWith(order, (order) =>
      shopifyFulfillmentStatus(order),
    ),
    fulfillment_status_label: deferWith(order, (order) =>
      shopifyFulfillmentStatusLabel(order),
    ),
    id: defer(() => order.id),
    item_count: deferWith(order, (order) => countItemQuantity(order.items)),
    line_items: lineItems,
    line_items_subtotal_price: defer(() => order.sub_total),
    metafields: {},
    name: defer(() => order.number),
    note: defer(() => order.comments),
    order_number: defer(() => order.number),
    order_status_url: '', // TODO
    phone:
      customerAccount &&
      deferWith(
        [order, customerAccount],
        (order, account) =>
          order.billing?.phone || order.shipping.phone || account.phone,
      ),
    'pickup_in_store?': false, //  TODO
    shipping_address: deferWith(order, () =>
      ShopifyAddress(instance, order.shipping),
    ),
    shipping_methods: defer(() => {
      const shippingMethod = ShopifyShippingMethod(order);
      return shippingMethod ? [shippingMethod] : [];
    }),
    shipping_price: defer(() => order.shipment_total),
    subtotal_line_items: lineItems,
    subtotal_price: defer(() => order.sub_total),
    tags: [], // N/A
    tax_lines: [], // TODO
    tax_price: defer(() => order.tax_total),
    total_discounts: defer(() => order.discount_total),
    total_duties: 0,
    total_net_amount: defer(() => order.grand_total),
    total_price: defer(() => order.grand_total),
    total_refunded_amount: defer(() => order.refund_total),
    transactions: [],

    // TODO
    // cancel_reason
    // cancel_reason_label
  });
}

export function shopifyFinancialStatus(order: SwellData) {
  if (refundDue(order)) {
    return 'paid'; // 'refund_due';
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
  return 'paid'; // 'complete';
}

export function shopifyFulfillmentStatus(order: SwellData) {
  // TODO: figure out what the options are on shopify, they're not documented
  if (order.canceled) {
    return 'restocked';
  }

  if (order.hold || order.status === 'hold') {
    return 'unfulfilled'; // 'on_hold';
  }

  if (order.delivered) {
    if (order.item_quantity_returned > 0 || order.return_total > 0) {
      if (order.item_quantity_returned === order.item_quantity) {
        return 'restocked'; // 'returned';
      }

      return 'partial'; // 'partially_returned';
    }

    return 'fulfilled';
  }

  if (order.item_quantity_delivered > 0) {
    return 'partial'; // 'partially_fulfilled';
  }

  if (order.item_quantity_deliverable > 0) {
    return 'unfulfilled';
  }

  return 'complete';
}

export function shopifyFinancialStatusLabel(order: SwellData) {
  // TODO: localization
  return statusToLabel(shopifyFinancialStatus(order));
}

export function shopifyFulfillmentStatusLabel(order: SwellData) {
  // TODO: localization
  return statusToLabel(shopifyFulfillmentStatus(order));
}

function statusToLabel(status: string) {
  const label = status.replace(/\_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function paymentDue(order: SwellData) {
  if (!order.canceled && order.payment_balance < 0) {
    return -order.payment_balance;
  }

  return 0;
}

export function refundDue(order: SwellData) {
  if (order.canceled) {
    return order.payment_total - order.refund_total;
  }
  if (order.payment_balance > 0) {
    return order.payment_balance;
  }
  return 0;
}

function ShopifyShippingMethod(
  order: SwellData,
): ShopifyResource<ShopifyShippingMethod> | undefined {
  if (!order.shipping?.service) {
    return undefined;
  }

  return new ShopifyResource<ShopifyShippingMethod>({
    id: order.shipping.service,
    discount_allocations: [],
    handle: `${order.shipping.service}-${order.shipping.price}`,
    original_price: order.shipment_price,
    price: order.shipment_total,
    price_with_discounts: order.shipment_total,
    tax_lines: [], // N/A
    title: order.shipping.service_name || order.shipping.service,
  });
}
