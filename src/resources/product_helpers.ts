// Functions to calculate product properties

import type { SwellData } from 'types/swell';
import type {
  SwellProduct,
  SwellProductOption,
  SwellProductOptionValue,
  SwellProductPurchaseOptions,
  SwellProductPurchaseOptionSubscription,
  SwellVariant,
} from './swell_types';

export function isGiftcard(product: SwellProduct) {
  return product.type === 'giftcard';
}

export function isOptionAvailable(
  product: SwellProduct,
  option: SwellProductOption,
) {
  if (isGiftcard(product)) {
    return true;
  }

  return Boolean(option.active && option.name);
}

export function isProductAvailable(
  product: SwellProduct,
  variant?: SwellVariant,
) {
  if (product.stock_purchasable) {
    return true;
  }

  const stockStatus = (variant || product).stock_status;

  return !stockStatus || stockStatus === 'in_stock';
}

// get available variants
export function getAvailableVariants(product: SwellProduct) {
  return (product.variants?.results?.slice()?.reverse() || []).filter(
    (variant: SwellVariant) => isProductAvailable(product, variant),
  );
}

export function isOptionValueAvailable(
  option: SwellProductOption,
  value: SwellProductOptionValue,
  product: SwellProduct,
  availableVariants?: SwellVariant[],
) {
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
) {
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
) {
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
) {
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
) {
  const { purchase_options: purchaseOptions } = product;

  if (!purchaseOptions) {
    return null;
  }

  const { purchase_option: purchaseOption } = queryParams as {
    purchase_option?: {
      type: string;
    };
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
) {
  if (selectedPurchaseOptionType !== 'subscription') {
    return null;
  }

  const { purchase_option: purchaseOption } = queryParams as {
    purchase_option?: {
      plan_id?: string;
    };
  };
  let selectedPlan = null;

  if (purchaseOption?.plan_id) {
    selectedPlan = subscriptionPurchaseOption.plans.find(
      (plan) => plan.id === purchaseOption.plan_id,
    );
  }

  return selectedPlan || subscriptionPurchaseOption.plans[0];
}
