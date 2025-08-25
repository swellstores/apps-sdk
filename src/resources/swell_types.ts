// This file defines swell properties that are used for swell classes
// Currently only used properties are defined

import type { SwellStorefrontCollection } from '@/resources';
import type {
  SwellCollection,
  SwellFile,
  SwellProductFilter,
} from 'types/swell';
import type { Cart, Order, Subscription, Account, Address } from 'swell-js';

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
  variants: SwellCollection<SwellVariant>;
}

/* Category Types */

export interface SwellCategory {
  id: string;
  slug: string;
  name: string;
  products?: SwellStorefrontCollection<SwellProduct>;
  filter_options: SwellProductFilter[];
  sort?: string;
  sort_options: SwellSortOption[];
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
  blogs?: SwellCollection<SwellBlog>;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  date_created: string;
  date_updated?: string;
}

export interface SwellBlog {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  date_published?: string;
  content?: string;
  summary?: string;
  image?: SwellFile;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  author_id: string;
  category_id: string;
  tags?: string[];
  theme_template?: string;
  date_created: string;
  date_updated?: string;
  category?: SwellBlogCategory;
  author?: SwellBlogAuthor;
}

/* Page Types */

export interface SwellPage {
  id: string;
  /** @deprecated */
  name: string;
  title: string;
  slug: string;
  content?: string;
  published: boolean;
  date_published?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  theme_template?: string;
  date_created: string;
  date_updated?: string;
}

/* Filter Types */

export interface SwellSortOption {
  value: string;
  name: string;
  query?: string;
}

export interface SwellSearch {
  query?: string;
  performed: boolean;
  filter_options: SwellProductFilter[];
  sort?: string;
  sort_options: SwellSortOption[];
}

export interface SwellPredictiveSearch {
  query?: string;
  performed: boolean;
  products?: SwellStorefrontCollection<SwellProduct>;
}

/* Account Types */

export type SwellAddress = Address;

export type SwellAccount = Account;

/* Cart Types */

export type SwellCart = Cart;

/* Order Types */

export type SwellOrder = Order;

/* Subscription Types */

export type SwellSubscription = Subscription;
