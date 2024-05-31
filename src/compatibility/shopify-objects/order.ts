import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyAddress from './address';
import ShopifyCustomer from './customer';
import { ShopifyLineItem, countItemQuantity } from './cart';

export default function ShopifyOrder(
  instance: ShopifyCompatibility,
  order: StorefrontResource | SwellRecord,
  account?: StorefrontResource | SwellRecord,
): ShopifyResource {
  if (order instanceof ShopifyResource) {
    return order.clone();
  }

  const customerAccount = account || order.account;

  return new ShopifyResource({
    attributes: defer(() => order.metadata),
    billing_address: deferWith(order, () =>
      ShopifyAddress(instance, order.billing),
    ),
    cancel_reason: null, // TODO
    cancel_reason_label: null, // TODO
    cancelled: defer(() => order.canceled),
    cancelled_at: defer(() => order.date_canceled),
    cart_level_discount_applications: [], // TODO
    confirmation_number: defer(() => order.number),
    created_at: defer(() => order.date_created),
    customer: defer(() => ShopifyCustomer(instance, customerAccount)),
    customer_order_url: deferWith(
      order,
      (order: any) => `/account/orders/${order.id}`,
    ),
    customer_url: deferWith(
      order,
      (order: any) => `/account/orders/${order.id}`,
    ),
    discount_applications: [], // TODO
    email: deferWith(customerAccount, (account: any) => account.email),
    financial_status: deferWith(
      order,
      (order: any) =>
        //https://shopify.dev/docs/api/liquid/objects/order#order-financial_status
        'paid', // TODO
    ),
    financial_status_label: deferWith(
      order,
      (order: any) => 'Paid', // TODO
    ),
    fulfillment_status: deferWith(
      order,
      (order: any) => 'fulfilled', // TODO
    ),
    fulfillment_status_label: deferWith(
      order,
      (order: any) => 'Fulfilled', // TODO
    ),
    id: defer(() => order.id),
    item_count: deferWith(order, (order: any) =>
      countItemQuantity(order.items),
    ),
    items: deferWith(order, (order: any) =>
      order.items?.map((item: any) => ShopifyLineItem(instance, order, item)),
    ),
    items_subtotal_price: defer(() => order.sub_total),
    name: defer(() => order.number),
    note: defer(() => order.comments),
    original_total_price: deferWith(
      order,
      (order: any) => order.sub_total + order.item_discount,
    ),
    requires_shipping: defer(() => Boolean(order.shipment_delivery)),
    taxes_included: defer(() => Boolean(order.item_tax_included)),
    total_discount: defer(() => order.discount_total),
    total_net_amount: defer(() => order.grand_total),
    total_price: defer(() => order.grand_total),
    total_weight: defer(() => order.item_shipment_weight),
  });
}
