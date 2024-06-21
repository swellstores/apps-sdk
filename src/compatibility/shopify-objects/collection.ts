import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, deferWith } from './resource';
import ShopifyProduct from './product';
import ShopifyImage from './image';
import qs from 'qs';

export default function ShopifyCollection(
  instance: ShopifyCompatibility,
  category: StorefrontResource | SwellRecord,
) {
  if (category instanceof ShopifyResource) {
    return category.clone();
  }

  return new ShopifyResource({
    all_products_count: deferWith(
      category,
      async (category: any) => category.products?.count || 0,
    ),
    all_tags: deferWith(
      category,
      async (category: any) =>
        category.products?.results?.reduce(
          (types: any[], product: SwellRecord) => {
            return types.concat(product.tags || []);
          },
          [],
        ) || [],
    ),
    all_types: deferWith(
      category,
      (category: any) =>
        category.products?.results?.reduce(
          (types: any[], product: SwellRecord) => {
            return types.concat(product.type || []);
          },
          [],
        ) || [],
    ),
    all_vendors: [],
    current_type: null,
    current_vendor: null,
    default_sort_by: 'popularity',
    description: null,
    featured_image: deferWith(
      category,
      (category: any) =>
        category.images?.[0] && ShopifyImage(instance, category.images[0]),
    ),
    filters: deferWith(
      category,
      (category: any) =>
        category.products?.filter_options?.map((filter: any) =>
          ShopifyFilter(instance, filter),
        ) || [],
    ),
    handle: 'all',
    id: 'all',
    image: null,
    metafields: null,
    next_product: null,
    previous_product: null,
    products: deferWith(category, async (category: any) => {
      return (
        category.products?.results?.map((product: any) =>
          ShopifyProduct(instance, product),
        ) || []
      );
    }),
    products_count: deferWith(
      category,
      (category: any) => category?.products.results?.length || 0,
    ),
    published_at: null,
    sort_by: instance.swell.queryParams.sort || '',
    sort_options: deferWith(
      category,
      (category: any) => category.products?.sort_options || [],
    ),
    tags: [],
    template_suffix: null,
    title: deferWith(category, (category: any) => category.name),
    url: deferWith(
      category,
      (category: any) => `/collections/${category.slug}`,
    ),
  });
}

export function ShopifyFilter(
  instance: ShopifyCompatibility,
  filter: SwellRecord,
) {
  const rangeOptionMin = filter.type === 'range' ? filter.options[0] : null;

  const rangeOptionMax =
    filter.type === 'range' ? filter.options[filter.options.length - 1] : null;

  return new ShopifyResource({
    active_values: filter.active_options?.map((option: SwellData) =>
      ShopifyFilterValue(instance, option, filter),
    ),
    false_value: ShopifyFilterValue(instance, { value: '' }, filter),
    inactive_values: filter.inactive_options?.map((option: SwellData) =>
      ShopifyFilterValue(instance, option, filter),
    ),
    label: filter.label,
    max_value:
      rangeOptionMax &&
      filter.active_options?.includes(rangeOptionMax) &&
      ShopifyFilterValue(instance, rangeOptionMax, filter, 'lte'),
    rangeOptionMin:
      rangeOptionMin &&
      filter.active_options?.includes(rangeOptionMin) &&
      ShopifyFilterValue(instance, rangeOptionMin, filter, 'gte'),
    operator: 'AND',
    param_name: filter.param_name,
    presentation: 'text', // TODO: image, swatch
    range_max: rangeOptionMax?.value || null,
    true_value: ShopifyFilterValue(instance, { value: true }, filter),
    type: filter.id === 'price' ? 'price_range' : 'list', // TODO: boolean support
    url_to_remove: removeFilterFromUrl(instance, `filter_${filter.id}`, true),
    values:
      filter.id !== 'price' &&
      filter.options?.map((option: SwellData) =>
        ShopifyFilterValue(instance, option, filter),
      ),
  });
}

export function ShopifyFilterValue(
  instance: ShopifyCompatibility,
  filterOption: SwellData,
  filter: SwellRecord,
  paramSuffix?: string,
) {
  return new ShopifyResource({
    active: filterOption.active,
    count: filterOption.count,
    image: null, // TODO when we support images in options
    label: filterOption.label,
    param_name: paramSuffix
      ? `${filter.param_name}[${paramSuffix}]`
      : filter.param_name,
    swatch: null, // TODO when we support swatches
    url_to_add: addFilterValueToUrl(
      instance,
      filter.param_name,
      filterOption.value,
    ),
    url_to_remove: removeFilterValueFromUrl(
      instance,
      filter.param_name,
      filterOption.value,
    ),
    value: filterOption.value,
  });
}

function removeFilterFromUrl(
  instance: ShopifyCompatibility,
  filter: string,
  isRange: boolean = false,
) {
  const { url, queryParams } = instance.swell;
  return `${url.pathname}?${stringifyFilterQuery({
    ...queryParams,
    ...(isRange
      ? { [`${filter}[gte]`]: undefined, [`${filter}[lte]`]: undefined }
      : undefined),
    [filter]: undefined,
  })}`;
}

function removeFilterValueFromUrl(
  instance: ShopifyCompatibility,
  filter: string,
  value: string,
) {
  const { url, queryParams } = instance.swell;
  return `${url.pathname}?${stringifyFilterQuery({
    ...queryParams,
    [filter]: Array.isArray(queryParams[filter])
      ? queryParams[filter].filter((v: string) => v !== value)
      : undefined,
  })}`;
}

function addFilterValueToUrl(
  instance: ShopifyCompatibility,
  filter: string,
  value: string,
) {
  const { url, queryParams } = instance.swell;
  return `${url.pathname}?${stringifyFilterQuery({
    ...queryParams,
    [filter]: Array.isArray(queryParams[filter])
      ? queryParams[filter].concat(value)
      : value,
  })}`;
}

function stringifyFilterQuery(query: SwellData) {
  return (
    qs
      .stringify({
        ...query,
        page: undefined,
        sections: undefined,
        section_id: undefined,
      })
      // Use actual brackets
      .replace(/%5B/g, '[')
      .replace(/%5D/g, ']')
  );
}
