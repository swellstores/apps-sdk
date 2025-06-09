import type { ShopifyProduct, ShopifyVariant } from './shopify';
import type { SwellData } from './swell';

export interface SwellStorefrontVariantPrice {
  account_group?: string;
  quantity_min: number;
  price: number;
}

export interface SwellStorefrontVariant {
  id: string;
  stock_status?: string;
  option_value_ids: string[];
  images: SwellData[];
  orig_price: number;
  stock_level?: number;
  price: number;
  name: string;
  weight: number;
  weight_unit: string;
  sku: string;
  prices?: SwellStorefrontVariantPrice[];
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
  variant: boolean;
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
  images: SwellData[];
  delivery: string;
  sku?: string;
  url: string;
  variants: {
    results: SwellStorefrontVariant[];
  };
  // ... all properties
}

// Omit<SwellStorefrontProduct, 'id' | 'slug' | 'orig_price' | 'variants'>
export interface SwellShopifyProduct extends ShopifyProduct {
  selected_option_values: string[];
}

export interface SwellShopifyVariant extends ShopifyVariant {
  selected_option_values: string[];
}
