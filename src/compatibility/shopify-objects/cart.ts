import { StorefrontResource, cloneStorefrontResource } from '@/resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyLineItem, { countItemQuantity } from './line_item';
import ShopifyCurrency from './currency';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';
import type { ShopifyCart } from 'types/shopify';

export default function ShopifyCart(
  instance: ShopifyCompatibility,
  cart: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyCart> {
  if (cart instanceof ShopifyResource) {
    return cart.clone() as ShopifyResource<ShopifyCart>;
  }

  if (cart instanceof StorefrontResource) {
    cart = cloneStorefrontResource(cart);
  }

  return new ShopifyResource<ShopifyCart>({
    attributes: defer(() => cart.metadata),
    cart_level_discount_applications: [], // TODO cart-level promotions
    checkout_charge_amount: defer(() => cart.grand_total),
    currency: deferWith(cart, (cart) =>
      ShopifyCurrency(instance, cart.currency),
    ),
    discounts: [],
    discount_applications: [], // TODO all promotions
    duties_included: defer(() => cart.item_tax_included),
    'empty?': deferWith(cart, (cart) => !cart.items?.length),
    item_count: deferWith(cart, (cart) => countItemQuantity(cart.items)),
    items: deferWith(cart, (cart: SwellRecord) => {
      if (!Array.isArray(cart.items)) {
        return [];
      }

      return cart.items.map((item: SwellRecord) =>
        ShopifyLineItem(instance, item, cart),
      );
    }),
    items_subtotal_price: defer(() => cart.sub_total),
    note: defer(() => cart.comments),
    original_total_price: deferWith(
      cart,
      (cart) => cart.sub_total + cart.item_discount,
    ),
    requires_shipping: defer(() => Boolean(cart.shipment_delivery)),
    taxes_included: defer(() => Boolean(cart.item_tax_included)),
    total_discount: defer(() => cart.discount_total),
    total_price: defer(() => cart.grand_total),
    total_weight: defer(() => cart.item_shipment_weight),
  });
}
