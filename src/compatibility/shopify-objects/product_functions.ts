import type { SwellData, SwellRecord } from 'types/swell';

function getAvailableVariants(product: SwellRecord) {
  // Using slice() to avoid mutating the original array with reverse()
  return (product.variants?.results?.slice()?.reverse() || []).filter(
    (variant: any) =>
      variant.stock_status === 'in_stock' || !variant.stock_status,
  );
}

export function getSelectedVariant(
  product: SwellRecord,
  queryParams: SwellData,
): SwellRecord | undefined {
  const { variant: queryVariant, option_values: queryOptionValues } =
    queryParams;
  const variants = getAvailableVariants(product);

  let selectedVariant = undefined;

  if (queryVariant) {
    selectedVariant = variants.find(
      (variant: any) => variant.id === queryVariant,
    );
  } else if (queryOptionValues) {
    const optionValues = queryOptionValues.split(',');

    // non-variant options are skipped
    selectedVariant = variants.find((variant: SwellRecord) =>
      variant.option_value_ids.every((optionValueId: string) =>
        optionValues.includes(optionValueId),
      ),
    );
  }

  return selectedVariant || variants?.[0] || undefined;
}

// calculate additional price from selected options
export function calculateAddOptionsPrice(product: any, queryParams: SwellData) {
  const { option_values: queryOptionValues = '' } = queryParams;
  const optionValues = queryOptionValues.split(',');

  const addPrice = product.options?.reduce((acc: any, option: any) => {
    if (!option.active || !option.values || option.values.length <= 0) {
      return acc;
    }

    if (option.input_type !== 'select') {
      return acc;
    }

    for (const value of option.values) {
      if (optionValues.includes(value.id)) {
        return acc + (value.price || 0);
      }
    }

    return acc + (option.values[0].price || 0);
  }, 0);

  return product.price + (addPrice || 0);
}

export function getSelectedOptionValues(product: any, queryParams: SwellData) {
  const variant = getSelectedVariant(product, queryParams);
  return getSelectedVariantOptionValues(product, variant, queryParams);
}

// collect all option values including non-variant. Select first by default
export function getSelectedVariantOptionValues(
  product: any,
  variant: any,
  queryParams: SwellData,
) {
  const { option_values: queryOptionValues = '' } = queryParams;
  const optionValues = queryOptionValues.split(',');

  const selectedValues = variant ? [...(variant.option_value_ids || [])] : [];
  const values: string[] = [];
  for (const option of product.options || []) {
    if (
      option.active &&
      option.values?.length > 0 &&
      option.input_type === 'select'
    ) {
      let selectedByVariantId = '';
      let selectedByOptionId = '';
      for (const value of option.values) {
        if (selectedValues.includes(value.id)) {
          selectedByVariantId = value.id;
          break;
        }

        if (optionValues.includes(value.id)) {
          selectedByOptionId = value.id;
        }
      }

      values.push(
        selectedByVariantId || selectedByOptionId || option.values[0].id,
      );
    }
  }

  return values;
}

// calculate additional price from selected non-variant options
export function getVariantPrice(product: any, variant: any, queryParams: SwellData) {
  const { option_values: queryOptionValues = '' } = queryParams;
  const optionValues = queryOptionValues.split(',');

  const addPrice = product.options?.reduce((acc: any, option: any) => {
    if (
      option.variant || // skip variant options
      !option.active ||
      !option.values ||
      option.values.length <= 0
    ) {
      return acc;
    }

    if (option.input_type !== 'select') {
      return acc;
    }

    // only non-variant options
    for (const value of option.values) {
      if (optionValues.includes(value.id)) {
        return acc + (value.price || 0);
      }
    }

    return acc + (option.values[0].price || 0);
  }, 0);

  let price = product.price;
  if (variant.price !== null && variant.price !== undefined) {
    price = variant.price;
  }

  return price + (addPrice || 0);
}
