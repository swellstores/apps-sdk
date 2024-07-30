import { ShopifyCompatibility } from '../shopify';
import { ShopifyResource } from './resource';
import { stringifyQueryParams } from '../../utils';

import { isObject } from 'lodash-es';

export default function ShopifyFilter(
  instance: ShopifyCompatibility,
  filter: SwellRecord,
) {
  const isRange = filter.type === 'range';
  const isBoolean = filter.type === 'boolean';

  return new ShopifyResource({
    active_values: !isRange
      ? filter.active_options?.map((option: SwellData) =>
          ShopifyFilterValue(instance, option, filter),
        )
      : undefined,
    false_value: isBoolean
      ? ShopifyFilterValue(instance, { value: '' }, filter)
      : undefined,
    inactive_values: !isRange
      ? filter.inactive_options?.map((option: SwellData) =>
          ShopifyFilterValue(instance, option, filter),
        )
      : undefined,
    label: filter.label,
    max_value: isRange
      ? ShopifyFilterValue(instance, { value: filter.range_max }, filter, 'lte')
      : undefined,
    min_value: isRange
      ? ShopifyFilterValue(instance, { value: filter.range_min }, filter, 'gte')
      : undefined,
    operator: isRange ? 'AND' : 'OR',
    param_name: filter.param_name,
    presentation: 'text', // TODO: image, swatch
    range_max: filter.range_max,
    true_value: isBoolean
      ? ShopifyFilterValue(instance, { value: filter.options[0].value }, filter)
      : undefined,
    type:
      filter.id === 'price' ? 'price_range' : isBoolean ? 'boolean' : 'list',
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
  const paramName = paramSuffix
    ? `${filter.param_name}[${paramSuffix}]`
    : filter.param_name;

  return new ShopifyResource({
    active: filterOption.active,
    count: filterOption.count,
    image: null, // TODO when we support images in options
    label: filterOption.label,
    param_name: paramName,
    swatch: null, // TODO when we support swatches
    url_to_add: addFilterValueToUrl(instance, paramName, filterOption.value),
    url_to_remove: removeFilterValueFromUrl(
      instance,
      filter.param_name,
      filterOption.value,
    ),
    value: filterOptionValue(instance, filterOption, filter, paramSuffix),
  });
}

function filterOptionValue(
  instance: ShopifyCompatibility,
  filterOption: SwellData,
  filter: SwellData,
  paramSuffix?: string,
) {
  const { queryParams } = instance.swell;

  const queryValue = paramSuffix
    ? queryParams[filter.param_name]?.[paramSuffix]
    : queryParams[filter.param_name];

  return filter.type === 'range'
    ? queryValue !== undefined && queryValue !== ''
      ? queryValue
      : null
    : filterOption.value;
}

function cleanQueryParams(queryParams: SwellData) {
  return Object.keys(queryParams).reduce((acc: SwellData, key: string) => {
    if (queryParams[key] !== '') {
      acc[key] = isObject(queryParams[key])
        ? cleanQueryParams(queryParams[key])
        : queryParams[key];
    }
    return acc;
  }, {});
}

function removeFilterFromUrl(
  instance: ShopifyCompatibility,
  paramName: string,
  isRange: boolean = false,
) {
  const { queryParams } = instance.swell;

  const queryString = stringifyQueryParams({
    ...cleanQueryParams(queryParams),
    ...(isRange
      ? { [`${paramName}[gte]`]: undefined, [`${paramName}[lte]`]: undefined }
      : undefined),
    [paramName]: undefined,
    page: undefined,
  });

  return urlWithQueryString(instance, queryString);
}

function removeFilterValueFromUrl(
  instance: ShopifyCompatibility,
  paramName: string,
  value: string,
) {
  const { queryParams } = instance.swell;

  const queryString = stringifyQueryParams({
    ...cleanQueryParams(queryParams),
    [paramName]: Array.isArray(queryParams[paramName])
      ? queryParams[paramName].filter((v: string) => v !== value)
      : undefined,
    page: undefined,
  });

  return urlWithQueryString(instance, queryString);
}

function addFilterValueToUrl(
  instance: ShopifyCompatibility,
  paramName: string,
  value: string,
) {
  const { queryParams } = instance.swell;

  const queryString = stringifyQueryParams({
    ...cleanQueryParams(queryParams),
    [paramName]: Array.isArray(queryParams[paramName])
      ? queryParams[paramName].concat(value)
      : typeof queryParams[paramName] === 'string'
      ? [queryParams[paramName], value]
      : value,
    page: undefined,
  });

  return urlWithQueryString(instance, queryString);
}

function urlWithQueryString(
  instance: ShopifyCompatibility,
  queryString: string,
) {
  const { url } = instance.swell;
  return `${url.pathname}${queryString ? `?${queryString}` : ''}`;
}
