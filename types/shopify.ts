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

export interface ShopifyPageResource {
  from: string;
  to: string;
  object(
    shopify: ShopifyCompatibility,
    value: StorefrontResource,
  ): ShopifyResource;
}

export interface ShopifyPage {
  page: string;
  resources: ShopifyPageResource[];
}

export type ShopifyPageResourceMap = Map<string, ShopifyPage>;

interface ShopifyObject {
  from: string;
  object(shopify: ShopifyCompatibility, value: SwellData): ShopifyResource;
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

export interface ShopifyImage {
  id: number;
  src: string;
  alt: string;
  media_type: string;
  preview_image?: ShopifyImage;
  presentation?: ShopifyImagePresentation;
  aspect_ratio: number;
  'attached_to_variant?'?: boolean;
  width: number;
  height: number;
  position: number;
  product_id?: number;
  variants: object[];
}

export interface ShopifyAddress {
  id: number;
  address1: string;
  address2?: string;
  city: string;
  company?: string;
  country: ShopifyCountry;
  country_code: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  phone: string;
  province: string;
  province_code: string;
  street: string;
  summary: string;
  url: string;
  zip: string;
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
  privacy_policy: object | null;
  products_count: number;
  published_locales: ShopifyLocale[];
  refund_policy: object | null;
  secure_url: string;
  shipping_policy: object | null;
  subscription_policy: object | null;
  /** @deprecated */
  taxes_included: boolean;
  terms_of_service: object | null;
  types: string[];
  url: string;
  vendors: string[];
}
