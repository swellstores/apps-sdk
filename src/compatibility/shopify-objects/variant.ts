import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyProduct from './product';
import ShopifyMedia from './media';

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
    available: defer(
      () => variant.stock_status === 'in_stock' || !variant.stock_status,
    ),
    barcode: null,
    compare_at_price: defer(() => variant.compare_price),
    featured_image: deferWith(
      [product, variant],
      (product: any, variant: any) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image && ShopifyMedia(instance, image);
      },
    ),
    featured_media: deferWith(
      [product, variant],
      (product: any, variant: any) => {
        const image = variant.images?.[0] || product.images?.[0];
        return image && ShopifyMedia(instance, image);
      },
    ),
    id: defer(() => variant.id),
    image: deferWith([product, variant], (product: any, variant: any) => {
      const image = variant.images?.[0] || product.images?.[0];
      return image && ShopifyMedia(instance, image);
    }),
    incoming: false,
    inventory_management: null,
    inventory_policy: null,
    matched: false,
    metafields: null,
    next_incoming_date: null,
    options: getOptions(product, variant),
    option1: getOptionByIndex(product, variant, 0), // Deprecated by Shopify
    option2: getOptionByIndex(product, variant, 1), // Deprecated by Shopify
    option3: getOptionByIndex(product, variant, 2), // Deprecated by Shopify
    price: defer(() =>
      variant.price !== null && variant.price !== undefined
        ? variant.price
        : product.price,
    ),
    product: deferWith(product, (product: any) => {
      return ShopifyProduct(instance, product, depth + 1);
    }),
    quantity_price_breaks: null,
    quantity_price_breaks_configured: deferWith(
      variant,
      () => variant.prices?.length > 0,
    ),
    quantity_rule: null,
    requires_selling_plan: false,
    requires_shipping: deferWith(product, () =>
      product.delivery?.contains('shipment'),
    ),
    selected: false,
    selected_selling_plan_allocation: null,
    selling_plan_allocations: null,
    sku: defer(() => variant.sku),
    store_availabilities: null,
    taxable: true,
    title: defer(() => variant.name),
    unit_price: defer(() => variant.price),
    unit_price_measurement: null,
    url: defer(() => product.url),
    weight: defer(() => variant.weight),
    weight_in_unit: defer(() => variant.weight_unit),
    weight_unit: defer(() => variant.weight_unit),
  });
}

function getOptions(product: any, variant: any) {
  return deferWith([product, variant], (product: any, variant: any) => {
    const optionValuesById = product.options?.reduce(
      (acc: any, option: any) => {
        for (const value of option.values) {
          if (!acc[value.id]) {
            acc[value.id] = value.name;
          }
        }
        return acc;
      },
      {},
    );
    return variant.option_value_ids?.map((id: any) => optionValuesById[id]);
  });
}

function getOptionByIndex(product: any, variant: any, index: number) {
  return deferWith([product, variant], (product: any, variant: any) => {
    const optionValuesById = product.options?.reduce(
      (acc: any, option: any) => {
        for (const value of option.values) {
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
