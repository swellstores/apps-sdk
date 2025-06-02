import type { SwellData, ThemeSectionEnabledDisabled } from './swell';

import type { ShopifyResource } from '../src/compatibility/shopify-objects/resource';
import type { ShopifyCompatibility } from '../src/compatibility/shopify';
import type { StorefrontResource } from '../src/resources';

export type ShopifyBasicInputType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'number'
  | 'range';

export type ShopifySpecializedInputType =
  | 'article'
  | 'blog'
  | 'collection'
  | 'collection_list'
  | 'color'
  | 'color_background'
  | 'color_scheme'
  | 'color_scheme_group'
  | 'font_picker'
  | 'header'
  | 'paragraph'
  | 'html'
  | 'image_picker'
  | 'inline_richtext'
  | 'link_list'
  | 'liquid'
  | 'page'
  | 'product'
  | 'product_list'
  | 'richtext'
  | 'text_alignment'
  | 'url'
  | 'video'
  | 'video_url';

export interface ShopifyBgStyleSchema {
  solid: string;
  gradient: string;
}

export interface ShopifySettingRoleSchema {
  background: string | ShopifyBgStyleSchema;
  primary_button: string | ShopifyBgStyleSchema;
  secondary_button: string | ShopifyBgStyleSchema;
  text: string;
  on_primary_button: string;
  primary_button_border: string;
  on_secondary_button: string;
  secondary_button_border: string;
  icons: string;
  links: string;
}

export interface ShopifyOptionItem {
  label: string | Record<string, string | undefined>;
  value: string;
}

export interface ShopifySettingDefinitionSchema {
  type: 'header' | 'color' | 'color_background';
  label: string;
  id?: string;
  info?: string;
  default?: any;
  placeholder?: string;
}

export interface ShopifySettingSchema {
  type: ShopifyBasicInputType | ShopifySpecializedInputType;
  label: string | Record<string, string | undefined>;
  id?: string;
  info?: string | Record<string, string | undefined>;
  default?: string | Record<string, string | undefined>;
  placeholder?: string;
  content?: string | Record<string, string | undefined>;

  // select
  options?: ShopifyOptionItem[];
  group?: string;

  // range
  min?: number;
  max?: number;
  step?: number;
  unit?: string;

  // collection_list
  limit?: number;

  // color_scheme_group
  definition?: ShopifySettingDefinitionSchema[];

  role?: ShopifySettingRoleSchema;

  // video_url
  accept?: string[]; // youtube, vimeo, or both
}

export interface ShopifySettingSection {
  name: string;
  settings?: ShopifySettingSchema[];
}

export type ShopifySettingsSchema = ShopifySettingSection[];

export interface ShopifySettingsData {
  current: Record<string, any> | string;
  presets: Record<string, ShopifySettingsDataPreset>;
  platform_customizations: PlatformCustomizations;
}

export interface ShopifySettingsDataPreset {
  [key: string]: any;
  sections?: Record<string, ShopifySettingsDataPresetSection>;
  content_for_index?: string[];
}

export interface ShopifySettingsDataPresetSection {
  type: string;
  settings: Record<string, any>;
  blocks?: Record<string, Record<string, any>>;
  block_order?: string[];
}

export interface ShopifySectionBlockSchema {
  type: string;
  name: string;
  limit?: number;
  settings: ShopifySettingSchema[];
}

export interface ShopifySectionPresetSchema {
  name: string;
  settings: ShopifySettingSchema[];
  blocks?: ShopifySectionBlockSchema[];
}

export interface ShopifySettingSection {
  name: string;
  settings?: ShopifySettingSchema[];
}

export interface ShopifySectionGroupItem {
  type: string;
  settings: Record<string, any>;
  blocks: Record<string, ShopifySectionBlockSchema>;
}

export interface ShopifySectionGroup {
  name: string;
  type: string;
  sections: Record<string, ShopifySectionGroupItem>;
  order: string[];
}

export interface ShopifySectionSchema {
  type?: string; // layout sections only
  name: string;
  tag?: string;
  class?: string;
  enabled_on?: ThemeSectionEnabledDisabled;
  disabled_on?: ThemeSectionEnabledDisabled;
  limit?: number;
  settings: ShopifySettingSchema[];
  blocks?: ShopifySectionBlockSchema[];
  presets?: ShopifySectionPresetSchema[];
  default?: ShopifySectionPresetSchema;
}

export interface PlatformCustomizations {
  custom_css?: string[];
}

export interface ShopifyPageResource {
  from: string;
  to: string;
  object(
    shopify: ShopifyCompatibility,
    value: StorefrontResource,
  ): ShopifyResource<object>;
}

export interface ShopifyPage {
  page: string;
  resources: ShopifyPageResource[];
}

export type ShopifyPageResourceMap = Map<string, ShopifyPage>;

interface ShopifyObject {
  from: string;
  object(
    shopify: ShopifyCompatibility,
    value: SwellData,
  ): ShopifyResource<object>;
}

export type ShopifyObjectResourceMap = Map<string, ShopifyObject>;

export interface ShopifyForm {
  type: string;
  shopifyType?: string;

  clientParams?(scope: SwellData, arg?: unknown): SwellData | undefined;
  clientHtml?(scope: SwellData, arg?: unknown): string | undefined;
  serverParams?(context: SwellData): SwellData;
  serverResponse?(context: SwellData): SwellData;
}

export type ShopifyFormResourceMap = ShopifyForm[];

export interface ShopifyQueryParams {
  from: string | ((param: string) => boolean);
  to: string | ((param: string, value: string) => SwellData);
}

export type ShopifyQueryParamsMap = ShopifyQueryParams[];

export interface ShopifyLocale {
  endonym_name: string;
  iso_code: string;
  name: string;
  primary: boolean;
  root_url: string;
}

export interface ShopifyCurrency {
  iso_code: string;
  name: string;
  symbol: string;
}

export interface ShopifyMarket {
  handle: string;
  id: number;
  metafields: Record<string, unknown>;
}

export interface ShopifyCountry {
  available_languages: ShopifyLocale[];
  continent:
    | 'Africa'
    | 'Asia'
    | 'Central America'
    | 'Europe'
    | 'North America'
    | 'Oceania'
    | 'South America';
  currency: ShopifyCurrency;
  iso_code: string;
  market: ShopifyMarket;
  name: string;
  'popular?': boolean;
  unit_system: 'imperial' | 'metric';
}

export interface ShopifyLocalization {
  available_countries: ShopifyCountry[];
  available_languages: ShopifyLocale[];
  country: ShopifyCountry;
  language: ShopifyLocale;
  market: ShopifyMarket;
}

export interface ShopifyFocalPoint {
  x: number;
  y: number;
}

export interface ShopifyImagePresentation {
  focal_point: ShopifyFocalPoint;
}

export interface ShopifyImageSrc {
  url: string;
  width: number;
  height: number;
}

export interface ShopifyImage {
  id: number;
  alt: string;
  src: ShopifyImageSrc;
  media_type?: 'image';
  preview_image?: ShopifyImage;
  presentation?: ShopifyImagePresentation;
  aspect_ratio: number;
  'attached_to_variant?'?: boolean;
  width: number;
  height: number;
  position?: number;
  product_id?: number;
  variants?: ShopifyVariant[];
}

export interface ShopifyMedia {
  alt: string;
  id: number;
  media_type: 'image' | 'model' | 'video' | 'external_video';
  position?: number;
  preview_image: ShopifyImage;
}

export interface ShopifyAddress {
  id: number;
  address1: string;
  address2?: string;
  city: string;
  company?: string;
  country: ShopifyCountry;
  country_code: string;
  first_name?: string;
  last_name?: string;
  name: string;
  phone: string;
  province: string;
  province_code: string;
  street: string;
  summary: string;
  url: string;
  zip: string;
}

export interface ShopifyLocation {
  address: ShopifyAddress;
  id: number;
  latitude: number;
  longitude: number;
  metafields: Record<string, unknown>;
  name: string;
}

export interface ShopifyBrand {
  colors: object;
  cover_image: ShopifyImage;
  favicon_url: ShopifyImage;
  logo: ShopifyImage;
  metafields: Record<string, unknown>;
  short_description: string;
  slogan: string;
  square_logo: ShopifyImage;
}

export interface ShopifyShop {
  accepts_gift_cards: boolean;
  address: ShopifyAddress;
  brand: ShopifyBrand;
  collections_count: number;
  currency: string;
  customer_accounts_enabled: boolean;
  customer_accounts_optional: boolean;
  description: string;
  domain: string;
  email: string;
  enabled_currencies: ShopifyCurrency[];
  /** @deprecated */
  enabled_locales: ShopifyLocale[];
  enabled_payment_types: string[];
  id: number;
  /** @deprecated */
  locale: string;
  metafields: Record<string, unknown>;
  /** @deprecated */
  metaobjects: Record<string, unknown>;
  money_format: string;
  money_with_currency_format: string;
  name: string;
  password_message: string;
  permanent_domain: string;
  phone: string;
  policies: object[];
  privacy_policy?: object;
  products_count: number;
  published_locales: ShopifyLocale[];
  refund_policy?: object;
  secure_url: string;
  shipping_policy?: object;
  subscription_policy?: object;
  /** @deprecated */
  taxes_included: boolean;
  terms_of_service?: object;
  types: string[];
  url: string;
  vendors: string[];
}

export interface ShopifyColor {
  alpha: number;
  blue: number;
  chroma: number;
  color_space: string;
  green: number;
  hue: number;
  lightness: number;
  oklch: string;
  oklcha: string;
  red: number;
  rgb: string;
  rgba: string;
  saturation: number;
}

export interface ShopifyLink {
  active: boolean;
  child_active: boolean;
  child_current: boolean;
  current: boolean;
  handle: string;
  levels: number;
  links: ShopifyLink[];
  object?: object;
  title: string;
  type:
    | 'article_link'
    | 'blog_link'
    | 'catalog_link'
    | 'collection_link'
    | 'collections_link'
    | 'customer_account_page_link'
    | 'frontpage_link'
    | 'http_link'
    | 'metaobject_link'
    | 'page_link'
    | 'policy_link'
    | 'product_link'
    | 'search_link';
  url: string;
}

export interface ShopifySwatch {
  color: ShopifyColor;
  image: ShopifyImage;
}

export interface ShopifySellingPlanCheckoutCharge {
  value: number;
  value_type: 'percentage' | 'price';
}

export interface ShopifySellingPlanOption {
  name: string;
  position: number;
  value: string;
}

export interface ShopifySellingPlanPriceAdjustment {
  order_count: number;
  position: number;
  value: number;
  value_type: 'percentage' | 'fixed_amount' | 'price';
}

export interface ShopifySellingPlan {
  checkout_charge: ShopifySellingPlanCheckoutCharge;
  description: string;
  group_id: string;
  id: number;
  name: string;
  options: ShopifySellingPlanOption[];
  price_adjustments: ShopifySellingPlanPriceAdjustment[];
  recurring_deliveries: boolean;
  selected: boolean;
}

export interface ShopifySellingPlanAllocationPriceAdjustment {
  position?: number;
  price: number; // TODO: ShopifyMoney
}

export interface ShopifySellingPlanAllocation {
  checkout_charge_amount: number; // TODO: ShopifyMoney
  compare_at_price: number; // TODO: ShopifyMoney
  per_delivery_price: number; // TODO: ShopifyMoney
  price: number; // TODO: ShopifyMoney
  price_adjustments: ShopifySellingPlanAllocationPriceAdjustment[];
  remaining_balance_charge_amount: number; // TODO: ShopifyMoney
  selling_plan: ShopifySellingPlan;
  selling_plan_group_id: string;
  unit_price?: number; // TODO: ShopifyMoney
}

export interface ShopifySellingPlanGroupOption {
  name: string;
  position: number;
  selected_value: string;
  values: string[];
}

export interface ShopifySellingPlanGroup {
  app_id?: string;
  id: number;
  name: string;
  options: ShopifySellingPlanGroupOption[];
  selling_plan_selected: boolean;
  selling_plans: ShopifySellingPlan[];
}

export interface ShopifyProductOption {
  name: string;
  position: number;
  selected_value?: string;
  values: ShopifyProductOptionValue[];
}

export interface ShopifyProduct {
  available: boolean;
  category: unknown;
  collections: ShopifyCollection[];
  compare_at_price: number;
  compare_at_price_max: number;
  compare_at_price_min: number;
  compare_at_price_varies: boolean;
  content: string;
  created_at: string;
  description: string;
  featured_image?: ShopifyImage;
  featured_media?: ShopifyMedia;
  first_available_variant?: ShopifyVariant;
  'gift_card?': boolean;
  handle: string;
  has_only_default_variant: boolean;
  id: number;
  images: ShopifyImage[];
  media: ShopifyMedia[];
  metafields: Record<string, unknown>;
  options: string[];
  options_by_name: Record<string, ShopifyProductOption | undefined>;
  options_with_values: ShopifyProductOption[];
  price: number;
  price_max: number;
  price_min: number;
  price_varies: boolean;
  published_at: string;
  'quantity_price_breaks_configured?': boolean;
  requires_selling_plan: boolean;
  selected_or_first_available_selling_plan_allocation?: ShopifySellingPlanAllocation;
  selected_or_first_available_variant: ShopifyVariant;
  selected_selling_plan?: ShopifySellingPlan;
  selected_selling_plan_allocation?: ShopifySellingPlanAllocation;
  selected_variant?: ShopifyVariant;
  selling_plan_groups: ShopifySellingPlanGroup[];
  tags: string[];
  template_suffix?: string;
  title: string;
  type: string;
  url: string;
  variants: ShopifyVariant[];
  variants_count: number;
  vendor?: string;
}

export interface ShopifyCollection {
  all_products_count: number;
  all_tags: string[];
  all_types: string[];
  all_vendors: string[];
  current_type?: string;
  current_vendor?: string;
  default_sort_by:
    | 'manual'
    | 'best-selling'
    | 'title-ascending'
    | 'price-ascending'
    | 'price-descending'
    | 'created-ascending'
    | 'created-descending';
  description: string;
  featured_image?: ShopifyImage;
  filters: ShopifyFilter[];
  handle: string;
  id: number;
  image?: ShopifyImage;
  metafields: Record<string, unknown>;
  next_product?: ShopifyProduct;
  previous_product?: ShopifyProduct;
  products: ShopifyProduct[];
  products_count: number;
  published_at: string;
  sort_by?: string;
  sort_options: ShopifySortOption[];
  tags: string[];
  template_suffix?: string;
  title: string;
  url: string;
}

export interface ShopifyFilterValueDisplayColors {
  type: 'colors';
  value: ShopifyColor[];
}

export interface ShopifyFilterValueDisplayImage {
  type: 'image';
  value: ShopifyImage;
}

export type ShopifyFilterValueDisplay =
  | ShopifyFilterValueDisplayColors
  | ShopifyFilterValueDisplayImage;

export interface ShopifyFilterValue {
  active: boolean;
  count: number;
  display?: ShopifyFilterValueDisplay;
  image?: ShopifyImage;
  label: string;
  param_name: string;
  swatch?: ShopifySwatch;
  url_to_add: string;
  url_to_remove: string;
  value: string;
}

export interface ShopifyFilter {
  active_values?: ShopifyFilterValue[];
  false_value?: ShopifyFilterValue;
  inactive_values?: ShopifyFilterValue[];
  label: string;
  max_value?: ShopifyFilterValue;
  min_value?: ShopifyFilterValue;
  operator?: 'AND' | 'OR';
  param_name: string;
  presentation?: 'image' | 'swatch' | 'text';
  range_max?: number;
  true_value?: ShopifyFilterValue;
  type: 'boolean' | 'list' | 'price_range';
  url_to_remove: string;
  values?: ShopifyFilterValue[];
}

export interface ShopifySortOption {
  name: string;
  value: string;
}

export interface ShopifyProductOptionValue {
  available: boolean;
  id: number;
  name: string;
  product_url?: string;
  selected: boolean;
  swatch?: ShopifySwatch;
  variant?: ShopifyVariant;
}

export interface ShopifyQuantityPriceBreak {
  minimum_quantity: number;
  price: number;
}

export interface ShopifyQuantityRule {
  increment: number;
  max: number;
  min: number;
}

export interface ShopifyStoreAvailability {
  available: boolean;
  location: ShopifyLocation;
  pick_up_enabled: boolean;
  pick_up_time: string;
}

export interface ShopifyUnitPriceMeasurement {
  measured_type: 'volume' | 'weight' | 'dimension';
  quantity_unit: string;
  quantity_value: number;
  reference_unit: string;
  reference_value: number;
}

export interface ShopifyVariant {
  available: boolean;
  barcode?: string;
  compare_at_price?: number;
  featured_image?: ShopifyImage;
  featured_media?: ShopifyMedia;
  id: number;
  image?: ShopifyImage;
  incoming: boolean;
  inventory_management?: string;
  inventory_policy: 'continue' | 'deny';
  inventory_quantity: number;
  matched: boolean;
  metafields: Record<string, unknown>;
  next_incoming_date?: string;
  /** @deprecated */
  option1?: string;
  /** @deprecated */
  option2?: string;
  /** @deprecated */
  option3?: string;
  options: ShopifyProductOptionValue[];
  price: number;
  product: ShopifyProduct;
  quantity_price_breaks: ShopifyQuantityPriceBreak[];
  'quantity_price_breaks_configured?': boolean;
  quantity_rule: ShopifyQuantityRule;
  requires_selling_plan: boolean;
  requires_shipping: boolean;
  selected: boolean;
  selected_selling_plan_allocation?: ShopifySellingPlanAllocation;
  selling_plan_allocations: ShopifySellingPlanAllocation[];
  sku: string;
  store_availabilities: ShopifyStoreAvailability[];
  taxable: boolean;
  title: string;
  unit_price: number;
  unit_price_measurement?: ShopifyUnitPriceMeasurement;
  url: string;
  weight: number;
  weight_in_unit: number;
  weight_unit?: string;
}

export interface ShopifyUser {
  account_owner: boolean;
  bio?: string;
  email: string;
  first_name: string;
  homepage?: string;
  image?: ShopifyImage;
  last_name: string;
  name: string;
}

export interface ShopifyComment {
  author: string;
  content: string;
  created_at: string;
  email: string;
  id: number;
  status: string;
  updated_at: string;
  url: string;
}

export interface ShopifyArticle {
  author: string;
  comment_post_url: string;
  comments: ShopifyComment[];
  comments_count: number;
  'comments_enabled?': boolean;
  content: string;
  created_at: string;
  excerpt: string;
  excerpt_or_content: string;
  handle: string;
  id: string;
  image?: ShopifyImage;
  metafields: Record<string, unknown>;
  'moderated?': boolean;
  published_at: string;
  tags: string[];
  template_suffix?: string;
  title: string;
  updated_at: string;
  url: string;
  user: ShopifyUser;
}

export interface ShopifyBlog {
  all_tags: string[];
  articles: ShopifyArticle[];
  articles_count: number;
  'comments_enabled?': boolean;
  handle: string;
  id: number;
  metafields: Record<string, unknown>;
  'moderated?': boolean;
  next_article?: ShopifyArticle;
  previous_article?: ShopifyArticle;
  tags: string[];
  template_suffix?: string;
  title: string;
  url: string;
}

export interface ShopifyOptionWithValue {
  name: string;
  value: string;
}

/** @deprecated */
export interface ShopifyDiscount {
  amount: number;
  code: string;
  savings: number;
  title: string;
  total_amount: number;
  total_savings: number;
  type: 'FixedAmountDiscount' | 'PercentageDiscount' | 'ShippingDiscount';
}

export interface ShopifyDiscountApplication {
  target_selection: 'all' | 'entitled' | 'explicit';
  target_type: 'line_item' | 'shipping_line';
  title: string;
  total_allocated_amount: number;
  type: 'automatic' | 'discount_code' | 'manual' | 'script';
  value: number;
  value_type: 'fixed_amount' | 'percentage';
}

export interface ShopifyDiscountAllocation {
  amount: number;
  discount_application: ShopifyDiscountApplication;
}

export interface ShopifyFulfillment {
  created_at: string;
  fulfillment_line_items: ShopifyLineItem[];
  item_count: number;
  tracking_company: string;
  tracking_number: string;
  tracking_numbers: string[];
  tracking_url: string;
}

export interface ShopifyTaxLine {
  price: number;
  rate: number;
  rate_percentage: number;
  title: string;
}

export interface ShopifyLineItem {
  /** @deprecated */
  discounts: ShopifyDiscount[];
  discount_allocations: ShopifyDiscountAllocation[];
  error_message?: string;
  final_line_price: number;
  final_price: number;
  fulfillment?: ShopifyFulfillment;
  fulfillment_service: string;
  gift_card: boolean;
  grams: number;
  id: number;
  image?: ShopifyImage;
  item_components: ShopifyLineItem[];
  key: string;
  line_level_discount_allocations: ShopifyDiscountAllocation[];
  line_level_total_discount: number;
  /** @deprecated */
  line_price: number;
  message?: string;
  options_with_values: ShopifyOptionWithValue[];
  original_line_price: number;
  original_price: number;
  /** @deprecated */
  price: number;
  product: ShopifyProduct;
  product_id: number;
  properties: Record<string, unknown>;
  quantity: number;
  requires_shipping: boolean;
  selling_plan_allocation?: ShopifySellingPlanAllocation;
  sku: string;
  successfully_fulfilled_quantity: number;
  tax_lines: ShopifyTaxLine[];
  taxable: boolean;
  title: string;
  /** @deprecated */
  total_discount: number;
  unit_price?: number;
  unit_price_measurement?: ShopifyUnitPriceMeasurement;
  url: string;
  url_to_remove: string;
  variant?: ShopifyVariant;
  variant_id?: number;
  vendor?: string;
}

export interface ShopifyCart {
  attributes: Record<string, unknown>;
  cart_level_discount_applications: ShopifyDiscountApplication[];
  checkout_charge_amount: number;
  currency: ShopifyCurrency;
  /** @deprecated */
  discounts: ShopifyDiscount[];
  discount_applications: ShopifyDiscountApplication[];
  duties_included: boolean;
  'empty?': boolean;
  item_count: number;
  items: ShopifyLineItem[];
  items_subtotal_price: number;
  note: string;
  original_total_price: number;
  requires_shipping: boolean;
  taxes_included: boolean;
  total_discount: number;
  total_price: number;
  total_weight: number;
}

export interface ShopifyCompanyAddress {
  address1: string;
  address2: string;
  attention?: string;
  city: string;
  country: ShopifyCountry;
  country_code: string;
  first_name: string;
  id: number;
  last_name: string;
  province?: string;
  province_code?: string;
  street: string;
  zip: string;
}

export interface ShopifyCompanyLocation {
  company: ShopifyCompany;
  'current?': boolean;
  external_id?: string;
  id: number;
  metafields: Record<string, unknown>;
  name: string;
  shipping_address: ShopifyCompanyAddress;
  tax_registration_id?: number;
  url_to_set_as_current: string;
}

export interface ShopifyCompany {
  available_locations: ShopifyCompanyLocation[];
  available_locations_count: number;
  external_id?: string;
  id: number;
  metafields: Record<string, unknown>;
  name: string;
}

export interface ShopifyMoney {
  value: number;
  decimals: number;
  currency: ShopifyCurrency;
}

export interface ShopifyStoreCreditAccount {
  balance: ShopifyMoney;
}

export interface ShopifyCustomerPaymentMethod {
  payment_instrument_type: string;
  token: string;
}

export interface ShopifyCustomer {
  accepts_marketing: boolean;
  addresses: ShopifyAddress[];
  addresses_count: number;
  'b2b?': boolean;
  company_available_locations: ShopifyCompanyLocation[];
  company_available_locations_count: number;
  current_company?: ShopifyCompany;
  current_location?: ShopifyCompanyLocation;
  default_address?: ShopifyAddress;
  email: string;
  first_name: string;
  has_account: boolean;
  'has_avatar?': boolean;
  id: number;
  last_name: number;
  last_order?: ShopifyOrder;
  name: string;
  orders: ShopifyOrder[];
  orders_count: number;
  payment_methods: ShopifyCustomerPaymentMethod[];
  phone: string;
  store_credit_account: ShopifyStoreCreditAccount;
  tags: string[];
  tax_exempt: boolean;
  total_spent: number;
}

export interface ShopifyRecipient {
  email: string;
  name: string;
  nickname: string;
}

export interface ShopifyGiftCard {
  balance: number;
  code: string;
  currency: string;
  customer: ShopifyCustomer;
  enabled: boolean;
  expired: boolean;
  expires_on: string;
  initial_value: number;
  last_four_characters: string;
  message?: string;
  pass_url: string;
  product: ShopifyProduct;
  properties: Record<string, unknown>;
  qr_identifier: string;
  recipient?: ShopifyRecipient;
  send_on?: string;
  template_suffix?: string;
  url: string;
}

export interface ShopifyPendingPaymentInstructionInput {
  header: string;
  value: string;
}

export interface ShopifyTransactionPaymentDetails {
  credit_card_company: string;
  credit_card_last_four_digits: string;
  credit_card_number: string;
  gift_card?: ShopifyGiftCard;
}

export interface ShopifyTransaction {
  amount: number;
  buyer_pending_payment_instructions: ShopifyPendingPaymentInstructionInput[];
  buyer_pending_payment_notice: string;
  created_at: string;
  gateway: string;
  gateway_display_name: string;
  id: number;
  kind: 'authorization' | 'capture' | 'sale' | 'void' | 'refund';
  name: string;
  payment_details: ShopifyTransactionPaymentDetails;
  receipt: string;
  'show_buyer_pending_payment_instructions?': boolean;
  status: 'success' | 'pending' | 'failure' | 'error';
  status_label: string;
}

export interface ShopifyShippingMethod {
  discount_allocations: ShopifyDiscountAllocation[];
  handle: string;
  id: string;
  original_price: number;
  /** @deprecated */
  price: number;
  price_with_discounts: number;
  tax_lines: ShopifyTaxLine[];
  title: string;
}

export interface ShopifyOrder {
  attributes: Record<string, unknown>;
  billing_address: ShopifyAddress;
  /** @deprecated */
  discounts: ShopifyDiscount[];
  cancel_reason?:
    | 'customer'
    | 'declined'
    | 'fraud'
    | 'inventory'
    | 'staff'
    | 'other';
  cancel_reason_label?: string;
  cancelled: boolean;
  cancelled_at?: string;
  cart_level_discount_applications: ShopifyDiscountApplication[];
  confirmation_number: string;
  created_at: string;
  customer: ShopifyCustomer;
  customer_order_url: string;
  customer_url: string;
  discount_applications: ShopifyDiscountApplication[];
  email: string;
  financial_status:
    | 'authorized'
    | 'expired'
    | 'paid'
    | 'partially_paid'
    | 'partially_refunded'
    | 'pending'
    | 'refunded'
    | 'unpaid'
    | 'voided';
  financial_status_label: string;
  fulfillment_status:
    | 'complete'
    | 'fulfilled'
    | 'partial'
    | 'restocked'
    | 'unfulfilled';
  fulfillment_status_label: string;
  id: number;
  item_count: number;
  line_items: ShopifyLineItem[];
  line_items_subtotal_price: number;
  metafields: Record<string, unknown>;
  name: string;
  note?: string;
  order_number: number;
  order_status_url: string;
  phone: string;
  'pickup_in_store?': boolean;
  shipping_address?: ShopifyAddress;
  shipping_methods: ShopifyShippingMethod[];
  shipping_price: number;
  subtotal_line_items: ShopifyLineItem[];
  subtotal_price: number;
  tags: string[];
  tax_lines: ShopifyTaxLine[];
  tax_price: number;
  total_discounts: number;
  total_duties: number;
  total_net_amount: number;
  total_price: number;
  total_refunded_amount: number;
  transactions: ShopifyTransaction[];
}

export interface ShopifyFont {
  baseline_ratio: number;
  fallback_families: string;
  family: string;
  style: string;
  'system?': boolean;
  variants: ShopifyFont[];
  weight: number;
}

export interface ShopifyFormErrors {
  messages: string[];
  translated_fields: string[];
  // TODO: iterator()
}

export interface ShopifyFormObject {
  address1?: string;
  address2?: string;
  author?: string;
  body?: string;
  city?: string;
  company?: string;
  country?: string;
  email?: string;
  errors?: ShopifyFormErrors;
  first_name?: string;
  id: string;
  last_name?: string;
  message?: string;
  name?: string;
  'password_needed?'?: boolean;
  phone?: string;
  'posted_successfully?': boolean;
  province?: string;
  set_as_default_checkbox?: string;
  zip?: string;
}

export interface ShopifyPageObject {
  author?: string;
  content: string;
  handle: string;
  id: number;
  metafields: Record<string, unknown>;
  published_at: string;
  template_suffix?: string;
  title: string;
  url: string;
}

export interface ShopifyTemplate {
  directory?: string;
  name:
    | '404'
    | 'article'
    | 'blog'
    | 'cart'
    | 'collection'
    | 'list-collections'
    | 'customers/account'
    | 'customers/activate_account'
    | 'customers/addresses'
    | 'customers/login'
    | 'customers/order'
    | 'customers/register'
    | 'customers/reset_password'
    | 'gift_card'
    | 'index'
    | 'page'
    | 'password'
    | 'product'
    | 'search';
  suffix?: string;
}

export interface ShopifySearch {
  default_sort_by: string;
  filters: ShopifyFilter[];
  performed: boolean;
  results: object[];
  results_count: number;
  sort_by?: string;
  sort_options: ShopifySortOption[];
  terms: string;
  types: Array<'article' | 'page' | 'product'>;
}

export interface ShopifyRecommendations {
  intent?: string;
  'performed?': boolean;
  products: ShopifyProduct[];
  products_count: number;
}

export interface ShopifyPredictiveSearchResources {
  articles: ShopifyArticle[];
  collections: ShopifyCollection[];
  pages: ShopifyPageObject[];
  products: ShopifyProduct[];
}

export interface ShopifyPredictiveSearch {
  performed: boolean;
  resources: ShopifyPredictiveSearchResources;
  terms: string;
  types: Array<'article' | 'collection' | 'page' | 'product'>;
}

export interface ShopifyPart {
  is_link: boolean;
  title: string;
  url?: string;
}

export interface ShopifyPaginate {
  current_offset: number;
  current_page: number;
  items: number;
  next?: ShopifyPart;
  page_param: string;
  page_size: number;
  pages: number;
  parts: ShopifyPart[];
  previous?: ShopifyPart;
}
