import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyImage from './image';
import ShopifyProduct from './product';
import ShopifyVariant from './variant';

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
    currency: defer(() => cart.currency),
    discount_applications: [], // TODO all promotions
    duties_included: defer(() => cart.item_tax_included),
    empty: defer(() => !cart.items?.length),
    item_count: deferWith(cart, (cart: any) => countItemQuantity(cart.items)),
    items: deferWith(cart, (cart: any) =>
      cart.items?.map((item: any) => ShopifyLineItem(instance, cart, item)),
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

function ShopifyLineItem(
  instance: ShopifyCompatibility,
  cart: StorefrontResource | SwellRecord,
  item: StorefrontResource | SwellRecord,
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
    fulfillment: deferWith(cart, (cart: any) => {
      // Note: this only supports one shipment per item
      const shipment = cart.shipments?.results?.find((shipment: any) =>
        shipment.items?.find(
          (shipmentItem: any) => shipmentItem.order_item_id === item.id,
        ),
      );
      if (!shipment) {
        return null;
      }
      return new ShopifyResource({
        created_at: shipment.date_created,
        fulfillment_line_items: shipment.items?.map((shipmentItem: any) =>
          ShopifyLineItem(instance, cart, shipmentItem),
        ),
        item_count: countItemQuantity(shipment.items),
        tracking_company: shipment.carrier_name || shipment.carrier,
        tracking_number: [shipment.tracking_code],
        tracking_url: null, // TODO
      });
    }),
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
      ShopifyLineItem(instance, cart, bundleItem),
    ),
    key: item.id, // Good enough
    line_level_discount_allocations: [], // TODO
    line_level_total_discount: item.discount_total, // TODO should be line discount only
    message: null, // N/A
    options_with_values: item.options,
    original_line_price: item.orig_price * item.quantity,
    original_price: item.orig_price,
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
    variant: deferWith(
      [item.product, item.variant],
      () =>
        item.variant && ShopifyVariant(instance, item.variant, item.product),
    ),
    vendor: null,
    /* user: deferWith(cart.account, (account: any) => {
      return account && {
        account_owner: true, // TODO
        bio: null,
        email: account.email,
        first_name: account.first_name,
        homepage: null,
        image: null,
        last_name: account.last_name,
        name: account.name,
      };
    }) */
    discounts: null, // Deprecated by Shopify
    line_price: item.price_total,
    price: item.price,
    total_discount: item.discount_total,
  });
}

export function countItemQuantity(items: any[], quantityField = 'quantity') {
  return items?.reduce((sum, item) => sum + item[quantityField], 0) || 0;
}
