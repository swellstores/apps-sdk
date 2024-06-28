import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyLineItem, { countItemQuantity } from './line_item';

export default function ShopifyCart(
  instance: ShopifyCompatibility,
  cart: StorefrontResource | SwellRecord,
) {
  if (cart instanceof ShopifyResource) {
    return cart.clone();
  }

  return new ShopifyResource({
    attributes: defer(() => cart.metadata),
    cart_level_discount_applications: [], // TODO cart-level promotions
    checkout_charge_amount: defer(() => cart.grand_total),
    currency: deferWith(cart, (cart: any) => cart.currency),
    discount_applications: [], // TODO all promotions
    duties_included: defer(() => cart.item_tax_included),
    empty: defer(() => !cart.items?.length),
    item_count: deferWith(cart, (cart: any) => countItemQuantity(cart.items)),
    items: deferWith(cart, (cart: any) =>
      cart.items?.map((item: any) => ShopifyLineItem(instance, item, cart)),
    ),
    items_subtotal_price: defer(() => cart.sub_total),
    note: defer(() => cart.comments),
    original_total_price: deferWith(
      cart,
      (cart: any) => cart.sub_total + cart.item_discount,
    ),
    requires_shipping: defer(() => Boolean(cart.shipment_delivery)),
    taxes_included: defer(() => Boolean(cart.item_tax_included)),
    total_discount: defer(() => cart.discount_total),
    total_price: defer(() => cart.grand_total),
    total_weight: defer(() => cart.item_shipment_weight),
  });
}
