import { isObject } from 'lodash-es';

import { stringifyQueryParams } from '@/utils';

import { ShopifyResource } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type {
  QueryParams,
  SwellProductFilter,
  SwellProductFilterOption,
} from 'types/swell';
import type { ShopifyFilter, ShopifyFilterValue } from 'types/shopify';

export default function ShopifyFilter(
  instance: ShopifyCompatibility,
  filter: SwellProductFilter,
): ShopifyResource<ShopifyFilter> {
  const isRange = filter.type === 'range';
  const isBoolean = filter.type === 'boolean';
  const isList = !isRange && !isBoolean;

  return new ShopifyResource<ShopifyFilter>({
    active_values: !isRange
      ? filter.active_options?.map((option) =>
          ShopifyFilterValue(instance, option, filter),
        )
      : undefined,
    false_value: isBoolean
      ? ShopifyFilterValue(instance, { value: '' }, filter)
      : undefined,
    inactive_values: !isRange
      ? filter.inactive_options?.map((option) =>
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
    presentation: isList ? 'text' : undefined, // TODO: image, swatch
    range_max: filter.range_max,
    true_value: isBoolean
      ? ShopifyFilterValue(
          instance,
          { value: filter.options?.[0].value },
          filter,
        )
      : undefined,
    type: isRange ? 'price_range' : isBoolean ? 'boolean' : 'list',
    url_to_remove: removeFilterFromUrl(instance, `filter_${filter.id}`, true),
    values: !isRange
      ? filter.options?.map((option) =>
          ShopifyFilterValue(instance, option, filter),
        )
      : undefined,
  });
}

export function ShopifyFilterValue(
  instance: ShopifyCompatibility,
  filterOption: SwellProductFilterOption,
  filter: SwellProductFilter,
  paramSuffix?: string,
): ShopifyResource<ShopifyFilterValue> {
  const paramName = paramSuffix
    ? `${filter.param_name}[${paramSuffix}]`
    : filter.param_name;

  return new ShopifyResource<ShopifyFilterValue>({
    active: filterOption.active ?? false,
    count: filterOption.count ?? 0,
    image: undefined, // TODO when we support images in options
    label: filterOption.label ?? '',
    param_name: paramName,
    swatch: undefined, // TODO when we support swatches
    url_to_add: addFilterValueToUrl(
      instance,
      paramName,
      filterOption.value as string,
    ),
    url_to_remove: removeFilterValueFromUrl(
      instance,
      filter.param_name,
      filterOption.value as string,
    ),
    value: filterOptionValue(
      instance,
      filterOption,
      filter,
      paramSuffix,
    ) as string,
  });
}

function filterOptionValue(
  instance: ShopifyCompatibility,
  filterOption: SwellProductFilterOption,
  filter: SwellProductFilter,
  paramSuffix?: string,
) {
  const { queryParams } = instance.swell;

  const queryValue: string | undefined = paramSuffix
    ? (queryParams[filter.param_name] as Record<string, string>)?.[paramSuffix]
    : (queryParams[filter.param_name] as string);

  return filter.type === 'range'
    ? queryValue !== undefined && queryValue !== ''
      ? queryValue
      : null
    : filterOption.value;
}

function cleanQueryParams(queryParams: QueryParams): Record<string, unknown> {
  return Object.keys(queryParams).reduce(
    (acc, key) => {
      const value = queryParams[key];

      if (value !== '') {
        acc[key] =
          isObject(value) && !Array.isArray(value)
            ? cleanQueryParams(value)
            : value;
      }

      return acc;
    },
    {} as Record<string, unknown>,
  );
}

function removeFilterFromUrl(
  instance: ShopifyCompatibility,
  paramName: string,
  isRange: boolean = false,
): string {
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
): string {
  const { queryParams } = instance.swell;

  const queryString = stringifyQueryParams({
    ...cleanQueryParams(queryParams),
    [paramName]: Array.isArray(queryParams[paramName])
      ? queryParams[paramName].filter((v) => v !== value)
      : undefined,
    page: undefined,
  });

  return urlWithQueryString(instance, queryString);
}

function addFilterValueToUrl(
  instance: ShopifyCompatibility,
  paramName: string,
  value: string,
): string {
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
): string {
  const { url } = instance.swell;
  return `${url.pathname}${queryString ? `?${queryString}` : ''}`;
}
