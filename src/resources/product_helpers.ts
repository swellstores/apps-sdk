// Functions to calculate product properties

import type { SwellData, SwellProductFilter } from 'types/swell';

import type {
  SwellProduct,
  SwellProductOption,
  SwellProductOptionValue,
  SwellProductPurchaseOptions,
  SwellProductPurchaseOptionSubscription,
  SwellSubscriptionPlan,
  SwellSortOption,
  SwellVariant,
} from './swell_types';

import type { Swell } from '@/api';

export function isGiftcard(product: SwellProduct): boolean {
  return product.type === 'giftcard';
}

export function isOptionAvailable(
  product: SwellProduct,
  option: SwellProductOption,
): boolean {
  if (isGiftcard(product)) {
    return true;
  }

  return Boolean(option.active && option.name);
}

export function isProductAvailable(
  product: SwellProduct,
  variant?: SwellVariant,
): boolean {
  if (product.stock_purchasable) {
    return true;
  }

  const stockStatus = (variant || product).stock_status;

  return !stockStatus || stockStatus === 'in_stock';
}

// get available variants
export function getAvailableVariants(product: SwellProduct): SwellVariant[] {
  return (product.variants?.results?.slice()?.reverse() || []).filter(
    (variant: SwellVariant) => isProductAvailable(product, variant),
  );
}

export function isOptionValueAvailable(
  option: SwellProductOption,
  value: SwellProductOptionValue,
  product: SwellProduct,
  availableVariants?: SwellVariant[],
): boolean {
  if (!option.variant) {
    return true;
  }

  const hasVariants = product.variants?.results.length > 0;

  if (!hasVariants) {
    return true;
  }

  const variants = availableVariants || getAvailableVariants(product);
  // An option value is considered available
  // if there is at least one available variant that includes this value.
  return variants.some((variant: SwellVariant) =>
    variant.option_value_ids.includes(value.id),
  );
}

export function isOptionValueSelected(
  option: SwellProductOption,
  value: SwellProductOptionValue,
  product: SwellProduct,
  queryParams: SwellData,
  selectedVariant?: SwellVariant,
): boolean {
  let variant;

  if (option.variant) {
    variant = selectedVariant || getSelectedVariant(product, queryParams);
  }

  const selectedOptionValues = getSelectedVariantOptionValues(
    product,
    queryParams,
    variant,
  );

  return selectedOptionValues.includes(value.id);
}

// get selected variant from options
export function getSelectedVariant(
  product: SwellProduct,
  queryParams: SwellData,
): SwellVariant | undefined {
  const {
    variant: queryVariant,
    option_values: queryOptionValues,
    selected_option_value: selectedOptionValue,
  } = queryParams as {
    variant?: string;
    option_values?: string;
    selected_option_value?: string;
  };
  const variants = getAvailableVariants(product);

  let selectedVariant = undefined;

  if (queryVariant) {
    selectedVariant = variants.find((variant) => variant.id === queryVariant);
  } else if (queryOptionValues) {
    const optionValues = queryOptionValues.split(',');

    // non-variant options are skipped
    selectedVariant = variants.find((variant) => {
      if (variant.option_value_ids.length !== optionValues.length) {
        return false;
      }

      return variant.option_value_ids.every((optionValueId: string) =>
        optionValues.includes(optionValueId),
      );
    });

    if (!selectedVariant && selectedOptionValue) {
      selectedVariant = variants.filter((variant) =>
        variant.option_value_ids.includes(selectedOptionValue),
      )[0];
    }
  }

  return selectedVariant || variants?.[0] || undefined;
}

// collect all option values including non-variant
export function getSelectedVariantOptionValues(
  product: SwellProduct,
  queryParams: SwellData,
  variant?: SwellVariant,
): string[] {
  if (variant) {
    return variant.option_value_ids;
  }

  const { option_values: queryOptionValues = '' } = queryParams as {
    option_values?: string;
  };
  const optionValues = queryOptionValues.split(',');

  return (product.options || []).reduce((acc, option) => {
    if (!option.values) {
      return acc;
    }

    const hasOptionValues = option.values.length > 0;

    if (!isOptionAvailable(product, option) || !hasOptionValues) {
      return acc;
    }

    const value = option.values.find((value) =>
      optionValues.includes(value.id),
    );

    if (value) {
      acc.push(value.id);
    }

    return acc;
  }, [] as string[]);
}

export function getPurchaseOptions(
  product: SwellProduct,
  queryParams: SwellData,
): SwellProductPurchaseOptions | null {
  if (!product?.purchase_options) {
    return null;
  }

  const { standard, subscription } = product.purchase_options;
  const selectedPurchaseOptionType = getSelectedPurchaseOptionType(
    product,
    queryParams,
  );

  const purchaseOptions: SwellProductPurchaseOptions = {};

  if (standard) {
    purchaseOptions.standard = {
      ...standard,
      selected: selectedPurchaseOptionType === 'standard',
    };
  }

  if (subscription) {
    const selectedPlan = getSelectedSubscriptionPurchaseOptionPlan(
      selectedPurchaseOptionType,
      subscription,
      queryParams,
    );

    purchaseOptions.subscription = {
      ...subscription,
      selected: selectedPurchaseOptionType === 'subscription',
      plans: subscription.plans.map((plan) => ({
        ...plan,
        selected: selectedPlan ? plan.id === selectedPlan.id : false,
      })),
    };
  }

  return Object.keys(purchaseOptions).length > 0 ? purchaseOptions : null;
}

function getSelectedPurchaseOptionType(
  product: SwellProduct,
  queryParams: SwellData,
): string | null {
  const { purchase_options: purchaseOptions } = product;

  if (!purchaseOptions) {
    return null;
  }

  const { purchase_option: purchaseOption } = queryParams as {
    purchase_option?: { type: string };
  };
  const purchaseOptionType = purchaseOption?.type;

  if (purchaseOptionType && purchaseOptionType in purchaseOptions) {
    return purchaseOptionType;
  }

  return purchaseOptions.standard ? 'standard' : 'subscription';
}

function getSelectedSubscriptionPurchaseOptionPlan(
  selectedPurchaseOptionType: string | null,
  subscriptionPurchaseOption: SwellProductPurchaseOptionSubscription,
  queryParams: SwellData,
): SwellSubscriptionPlan | null {
  if (selectedPurchaseOptionType !== 'subscription') {
    return null;
  }

  const { purchase_option: purchaseOption } = queryParams as {
    purchase_option?: { plan_id?: string };
  };
  let selectedPlan = null;

  if (purchaseOption?.plan_id) {
    selectedPlan = subscriptionPurchaseOption.plans.find(
      (plan) => plan.id === purchaseOption.plan_id,
    );
  }

  return selectedPlan || subscriptionPurchaseOption.plans[0];
}

const SORT_OPTIONS = Object.freeze<SwellSortOption[]>([
  { value: 'manual', name: 'Featured' },
  { value: 'popularity', name: 'Popularity', query: 'popularity desc' },
  { value: 'price_asc', name: 'Price, low to high', query: 'price asc' },
  { value: 'price_desc', name: 'Price, high to low', query: 'price desc' },
  { value: 'date_asc', name: 'Date, old to new', query: 'date_created asc' },
  { value: 'date_desc', name: 'Date, new to old', query: 'date_created desc' },
  { value: 'name_asc', name: 'Product name, A-Z', query: 'name asc' },
  { value: 'name_desc', name: 'Product name, Z-A', query: 'name desc' },
]);

export async function getProductFilters(
  swell: Swell,
  productQuery?: SwellData,
) {
  const sortBy = swell.queryParams.sort || 'manual';
  const filterQuery = productQueryWithFilters(swell, productQuery);

  return {
    filter_options: await getProductFiltersByQuery(swell, filterQuery),
    sort: SORT_OPTIONS.find((option) => option.value === sortBy)?.value,
    sort_options: [...SORT_OPTIONS],
  };
}

async function getProductFiltersByQuery(
  swell: Swell,
  query: SwellData = {},
): Promise<SwellProductFilter[]> {
  const filters =
    (await swell.get<SwellProductFilter[]>('/products/:filters', {
      ...query,
      sort: undefined,
    })) || [];

  if (!Array.isArray(filters)) {
    throw new Error('Product filters must be an array');
  }

  for (const filter of filters) {
    filter.param_name = `filter_${filter.id}`;

    if (Array.isArray(filter.options)) {
      filter.active_options = [];
      filter.inactive_options = [];

      // Option `active` state
      for (const option of filter.options) {
        const queryValue = swell.queryParams[filter.param_name];

        option.active = Array.isArray(queryValue)
          ? (queryValue as unknown[]).includes(option.value)
          : queryValue === option.value;

        // Active/inactive options
        const list = option.active
          ? filter.active_options
          : filter.inactive_options;

        list.push(option);
      }
    }
  }

  return filters;
}

export function productQueryWithFilters(swell: Swell, query?: SwellData) {
  const filters = Object.keys(swell.queryParams).reduce(
    (acc: Record<string, unknown>, key) => {
      if (key.startsWith('filter_')) {
        const qkey = key.replace('filter_', '');
        const value = swell.queryParams[key];

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          (value.gte !== undefined || value.lte !== undefined)
        ) {
          acc[qkey] = [value.gte || 0, value.lte || undefined];
        } else {
          acc[qkey] = value;
        }
      }

      return acc;
    },
    {},
  );

  const sortBy = swell.queryParams.sort || 'manual';

  return {
    sort:
      SORT_OPTIONS.find((option) => option.value === sortBy)?.query ||
      undefined,
    $filters: filters,
    ...query,
  };
}
