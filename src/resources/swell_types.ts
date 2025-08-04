// This file defines swell properties that are used for swell classes
// Currently only used properties are defined

export enum ScheduleInterval {
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Yearly = 'yearly',
}

/* Product Types */

export interface SwellProductOptionValue {
  id: string;
  name: string;
  price?: number;
}

export interface SwellProductOption {
  active: boolean;
  variant: boolean;
  name: string;
  input_type: string;
  values?: SwellProductOptionValue[];
}

export interface SwellVariant {
  id: string;
  stock_status?: string;
  option_value_ids: string[];
  selected_option_values: string[];
  price?: number;
}

export interface SwellBillingSchedule {
  interval: ScheduleInterval;
  interval_count: number;
  limit?: number;
  trial_days?: number;
}

export interface SwellOrderSchedule {
  interval: ScheduleInterval;
  interval_count: number;
  limit?: number;
}

export interface SwellSubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_schedule: SwellBillingSchedule;
  has_order_schedule?: boolean;
  order_schedule?: SwellOrderSchedule;
  selected?: boolean;
}

export interface SwellProductPurchaseOptionStandard {
  price: number;
  sale: boolean;
  sale_price?: number;
  orig_price?: number;
  selected?: boolean;
}

export interface SwellProductPurchaseOptionSubscription {
  plans: SwellSubscriptionPlan[];
  selected?: boolean;
}

export interface SwellProductPurchaseOptions {
  standard?: SwellProductPurchaseOptionStandard;
  subscription?: SwellProductPurchaseOptionSubscription;
}

export interface SwellProduct {
  id: string;
  price: number;
  type: string;
  options?: SwellProductOption[];
  selected_option_values?: string[];
  purchase_options?: SwellProductPurchaseOptions;
  stock_purchasable?: boolean;
  stock_status?: string;
  variants: {
    results: SwellVariant[];
  };
}

/* Blog Types */

export interface SwellBlogAuthor {
  id: string;
  name: string;
  email: string;
}

export interface SwellBlogCategory {
  id: string;
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  date_created: string;
}

export interface SwellBlog {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  author_id: string;
  category_id: string;
  tags: string[];
  date_created: string;
  category?: SwellBlogCategory;
  author?: SwellBlogAuthor;
}
