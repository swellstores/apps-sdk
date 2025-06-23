// Functions to calculate product properties

import type { SwellData, SwellRecord } from 'types/swell';
import type { PartialSwellProduct, PartialSwellVariant } from './swell_types';

// calculate additional price from selected options
export function calculateAddOptionsPrice(
  product: PartialSwellProduct,
  queryParams: SwellData,
) {
  const { option_values = '' } = queryParams;
  const queryOptionValues = option_values as string;
  const optionValues = queryOptionValues.split(',');

  const addPrice = product.options?.reduce((acc: number, option) => {
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

// calculate additional price from selected non-variant options
export function calculateAddOptionsVariantPrice(
  product: PartialSwellProduct,
  variant: PartialSwellVariant,
  queryParams: SwellData,
) {
  const { option_values = '' } = queryParams;
  const queryOptionValues = option_values as string;
  const optionValues = queryOptionValues.split(',');

  const addPrice = product.options?.reduce((acc: number, option) => {
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

// get available variants
function getAvailableVariants(product: PartialSwellProduct) {
  return (product.variants?.results?.slice()?.reverse() || []).filter(
    (variant: PartialSwellVariant) =>
      variant.stock_status === 'in_stock' || !variant.stock_status,
  );
}

// get selected variant from options
function getSelectedSwellVariant(
  product: PartialSwellProduct,
  queryParams: SwellData,
): PartialSwellVariant | undefined {
  const { variant: queryVariant, option_values } = queryParams;
  const queryOptionValues = option_values as string;
  const variants = getAvailableVariants(product);

  let selectedVariant = undefined;

  if (queryVariant) {
    selectedVariant = variants.find((variant) => variant.id === queryVariant);
  } else if (queryOptionValues) {
    const optionValues = queryOptionValues.split(',');

    // non-variant options are skipped
    selectedVariant = variants.find((variant) =>
      variant.option_value_ids.every((optionValueId: string) =>
        optionValues.includes(optionValueId),
      ),
    );
  }

  return selectedVariant || variants?.[0] || undefined;
}

// get selected variant from options
export function getSelectedVariant(
  product: SwellRecord,
  queryParams: SwellData,
): PartialSwellVariant | undefined {
  return getSelectedSwellVariant(
    product as unknown as PartialSwellProduct,
    queryParams,
  );
}

// collect all option values including non-variant for currently selected variant
export function getSelectedOptionValues(
  product: PartialSwellProduct,
  queryParams: SwellData,
) {
  const variant = getSelectedSwellVariant(product, queryParams);
  return getSelectedVariantOptionValues(product, variant, queryParams);
}

// collect all option values including non-variant. Select first by default
export function getSelectedVariantOptionValues(
  product: PartialSwellProduct,
  variant: PartialSwellVariant | undefined,
  queryParams: SwellData,
) {
  const { option_values = '' } = queryParams;
  const queryOptionValues = option_values as string;
  const optionValues = queryOptionValues.split(',');

  const selectedValues = variant ? [...(variant.option_value_ids || [])] : [];
  const values: string[] = [];
  for (const option of product.options || []) {
    if (
      option.active &&
      option.values &&
      option.values.length > 0 &&
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
