import type { ShopifyProduct } from './shopify';

export interface SwellStorefrontVariant {
  id: string;
  stock_status?: string;
  option_value_ids: string[];
}

export interface SwellStorefrontProductOptionValue {
  id: string;
  name: string;
  price?: number;
}

export interface SwellStorefrontProductOption {
  active: boolean;
  name: string;
  input_type: string;
  values: SwellStorefrontProductOptionValue[];
}

export interface SwellStorefrontProduct {
  id: string;
  slug: string;
  description: string;
  date_created: string;
  orig_price: number;
  options: SwellStorefrontProductOption[];
  price: number;
  name: string;
  type: string;
  tags: string[];
  // always empty there
  option_value_ids: string[];
  variants: {
    results: SwellStorefrontVariant[];
  };
  // ... all properties
}

// Omit<SwellStorefrontProduct, 'id' | 'slug' | 'orig_price' | 'variants'>
export interface SwellProduct extends ShopifyProduct {
  selected_option_values: string[];
}
