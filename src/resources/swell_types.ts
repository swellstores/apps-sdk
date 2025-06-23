// This file defines swell properties that are used for swell classes
// Currently only used properties are defined

export interface PartialSwellProductOptionValue {
  id: string;
  price?: number;
}

export interface PartialSwellProductOption {
  active: boolean;
  variant: boolean;
  input_type: string;
  values?: PartialSwellProductOptionValue[];
}

export interface PartialSwellVariant {
  id: string;
  stock_status?: string;
  option_value_ids: string[];
  selected_option_values: string[];
  price?: number;
}

export interface PartialSwellProduct {
  price: number;
  options?: PartialSwellProductOption[];
  selected_option_values?: string[];
  variants: {
    results: PartialSwellVariant[];
  };
}
