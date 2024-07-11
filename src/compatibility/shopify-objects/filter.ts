import { ShopifyCompatibility } from '../shopify';
import { ShopifyResource } from './resource';
import { stringifyQueryParams } from '../../utils';

export default function ShopifyFilter(
  instance: ShopifyCompatibility,
  filter: SwellRecord,
) {
  const isRange = filter.type === 'range';
  const isBoolean = false; // TODO: support boolean filters

  const rangeOptionMin = isRange ? filter.options[0] : null;

  const rangeOptionMax = isRange
    ? filter.options[filter.options.length - 1]
    : null;

  return new ShopifyResource({
    active_values:
      !isRange &&
      filter.active_options?.map((option: SwellData) =>
        ShopifyFilterValue(instance, option, filter),
      ),
    false_value: isBoolean
      ? ShopifyFilterValue(instance, { value: '' }, filter)
      : undefined,
    inactive_values:
      !isRange &&
      filter.inactive_options?.map((option: SwellData) =>
        ShopifyFilterValue(instance, option, filter),
      ),
    label: filter.label,
    max_value:
      rangeOptionMax &&
      filter.active_options?.includes(rangeOptionMax) &&
      ShopifyFilterValue(instance, rangeOptionMax, filter, 'lte'),
    min_value:
      rangeOptionMin &&
      filter.active_options?.includes(rangeOptionMin) &&
      ShopifyFilterValue(instance, rangeOptionMin, filter, 'gte'),
    operator: 'AND',
    param_name: filter.param_name,
    presentation: 'text', // TODO: image, swatch
    range_max: rangeOptionMax?.value || null,
    true_value: isBoolean
      ? ShopifyFilterValue(instance, { value: true }, filter)
      : undefined,
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
  return `${url.pathname}?${stringifyQueryParams({
    ...queryParams,
    ...(isRange
      ? { [`${filter}[gte]`]: undefined, [`${filter}[lte]`]: undefined }
      : undefined),
    [filter]: undefined,
    page: undefined,
  })}`;
}

function removeFilterValueFromUrl(
  instance: ShopifyCompatibility,
  filter: string,
  value: string,
) {
  const { url, queryParams } = instance.swell;
  return `${url.pathname}?${stringifyQueryParams({
    ...queryParams,
    [filter]: Array.isArray(queryParams[filter])
      ? queryParams[filter].filter((v: string) => v !== value)
      : undefined,
    page: undefined,
  })}`;
}

function addFilterValueToUrl(
  instance: ShopifyCompatibility,
  filter: string,
  value: string,
) {
  const { url, queryParams } = instance.swell;
  return `${url.pathname}?${stringifyQueryParams({
    ...queryParams,
    [filter]: Array.isArray(queryParams[filter])
      ? queryParams[filter].concat(value)
      : value,
    page: undefined,
  })}`;
}
