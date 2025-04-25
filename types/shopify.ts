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
  presets: Record<string, Record<string, any>>;
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

export interface ShopifySectionGroupSchema {
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
