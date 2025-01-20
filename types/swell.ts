import type {
  SwellStorefrontRecord,
  SwellStorefrontResource,
} from '../src/resources';

import type {
  Swell,
  SwellStorefrontCollection,
  StorefrontResource,
} from '../src/api';

import type { ShopifySettingSchema } from './shopify';

export interface SwellAppConfig {
  id: string;
  name: string;
  type: 'storefront' | string;
  version: string;
  description?: string;
  storefront?: { theme: SwellAppStorefrontThemeProps };
}

export interface SwellAppShopifyCompatibilityConfig {
  page_types: Record<string, string>;
  page_routes: Record<string, { page_id?: string } | string | null>;
  page_resources: Array<{
    page: string;
    resources: Array<{
      from: string;
      to: string;
      object: string;
    }>;
  }>;
  object_resources: Array<{
    from: string;
    object: string;
  }>;
  forms: Array<{
    id: string;
    shopify_type: string;
    client_params: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

export interface SwellAppStorefrontThemePage {
  id: string;
  url: string;
  label: string;
  group?: string;
  icon?: string;
  templates?: boolean;
  collection?: string;
  json?: boolean;
}

export interface SwellAppStorefrontThemeProps {
  provider: 'app';
  pages: Array<SwellAppStorefrontThemePage>;
  resources?: SwellAppStorefrontThemeResources;
}

export interface SwellAppStorefrontThemeResources {
  singletons: Record<string, string>;
  records: Record<string, string>;
}

export interface SwellErrorOptions {
  status?: number;
  method?: string;
  endpointUrl?: string;
}

export type SwellData = Record<string, any>;
export type SwellLocaleProp = Record<string, Record<string, string>>;
export type SwellCurrencyProp = Record<string, Record<string, number>>;

export interface SwellRecord {
  id: string;
  [key: string]: any;
  $locale?: SwellLocaleProp;
  $currency?: SwellCurrencyProp;
}

export interface SwellCollection<T = SwellRecord> {
  page: number;
  count: number;
  results: T[];
  page_count: number;
  limit: number;
  pages: SwellCollectionPages;
}

export type InferSwellCollection<T> = T extends SwellCollection<infer U>
  ? U
  : SwellData;

export interface SwellCollectionPage {
  start: number;
  end: number;
}

export type SwellCollectionPages = Record<string, SwellCollectionPage>;

export interface SwellThemeConfig extends SwellRecord {
  id: string;
  type: string;
  file_data: string;
  file_path: string;
}

export interface SwellMenu {
  id: string;
  name: string;
  handle?: string;
  items: SwellMenuItem[];
  $locale?: SwellLocaleProp;
}

export enum SwellMenuItemType {
  Home = 'home',
  Search = 'search',
  Product = 'product',
  ProductList = 'product_list',
  Category = 'category',
  Page = 'page',
  Blog = 'blog',
  BlogCatgory = 'blog_category',
  Content = 'content',
  ContentList = 'content_list',
  Url = 'url',
  Heading = 'heading',
}

export interface SwellMenuItem {
  name: string;
  type: SwellMenuItemType;
  items: SwellMenuItem[];
  model?: string;
  value?: string | Record<string, any>;
  url?: string;
  $locale?: SwellLocaleProp;
  // Dynamic properties
  resource?:
    | SwellStorefrontRecord
    | SwellStorefrontCollection
    | SwellStorefrontResource;
  levels: number;
  current?: boolean;
  active?: boolean;
  child_current?: boolean;
  child_active?: boolean;
}

export type StorefrontResourceGetter<T = SwellData> = () =>
  | Promise<T | null>
  | T
  | null;

export interface ThemeSettings {
  [key: string]: any;
}

export interface ThemeSettingsBlock {
  type: string;
  settings: ThemeSettings;
}

export interface ThemeSectionBase {
  id: string;
  type: string;
  settings: ThemeSettings;
  blocks?: ThemeSettingsBlock[];
  block_order?: string[];
}

export interface ThemeSectionSettings extends ThemeSettings {
  section: ThemeSectionBase;
}

// TODO: fix this
export type ThemePage = Record<string, any>;

export interface ThemeGlobals extends SwellData {
  store: SwellData;
  request: SwellData;
  settings: ThemeSettings;
  page: ThemePage;
  configs: ThemeConfigs;
  menus?: Record<string, SwellMenu>;
  [key: string]: any;
}

export interface ThemeConfigs {
  editor: ThemeEditorSchema;
  theme: ThemeSettings;
  presets: ThemePresetSchema[];
  translations: ThemeSettings;
  [key: string]: any;

  // Shopify compatibility
  settings_schema?: any;
  settings_data?: any;
}

export interface ThemeResourceFactory {
  new (swell: Swell): StorefrontResource;
}

export interface ThemeLookupResourceFactory {
  new (swell: Swell, id: string): StorefrontResource;
}

export interface ThemeResources {
  singletons?: {
    account?: ThemeResourceFactory;
    cart?: ThemeResourceFactory;
  };
  records?: Record<string, ThemeLookupResourceFactory>;
}

export interface ThemeEditorSchema {
  settings?: ThemeSettingSectionSchema[];
  menus?: any; // TODO menu schema?
}

export interface ThemeSection {
  id?: string;
  type: string;
  disabled?: boolean;
  settings: ThemeSettings;
  blocks?: Record<string, ThemeSettingsBlock>;
  block_order?: string[];
}

interface ThemeSectionGroupBase {
  id?: string;
  type?: string;
  order?: string[];
}

export interface ThemeSectionGroup extends ThemeSectionGroupBase {
  sections: Record<string, ThemeSection>;
}

export interface ThemeSectionConfig {
  id: string;
  section: ThemeSection;
  tag: string;
  schema?: ThemeSectionSchema | null;
  output?: string;
  settings?: ThemeSectionSettings;
  blocks?: ThemeSettingsBlock[];
  class?: string;
}

export interface ThemeSectionSchemaData {
  label: string;
  fields: ThemeSettingFieldSchema[];
  type?: string; // layout sections only
  tag?: string;
  class?: string;
  enabled_on?: ThemeSectionEnabledDisabled;
  disabled_on?: ThemeSectionEnabledDisabled;
  blocks?: ThemeBlockSchema[];
  presets?: ThemePresetSchema[];
  default?: ShopifySettingSchema;
}

export interface ThemeSectionSchema extends ThemeSectionSchemaData {
  id: string;
}

export type ThemeSettingBasicInputType =
  | 'short_text'
  | 'long_text'
  | 'paragraph'
  | 'boolean'
  | 'number'
  | 'date'
  | 'select'
  | 'asset'
  | 'tags'
  | 'collection'
  | 'color'
  | 'color_scheme'
  | 'color_scheme_group'
  | 'font'
  | 'header'
  | 'lookup'
  | 'generic_lookup'
  | 'menu'
  | 'icon'
  | 'field_group';

export type ThemeSettingAliasInputType =
  | 'text'
  | 'textarea'
  | 'rich_text'
  | 'asset'
  | 'phone'
  | 'email'
  | 'url'
  | 'slug'
  | 'basic_html'
  | 'rich_html'
  | 'markdown'
  | 'liquid'
  | 'checkbox'
  | 'toggle'
  | 'image'
  | 'document'
  | 'video'
  | 'radio'
  | 'dropdown'
  | 'checkboxes'
  | 'integer'
  | 'float'
  | 'currency'
  | 'percent'
  | 'slider'
  | 'time'
  | 'datetime'
  | 'child_collection'
  | 'product_lookup'
  | 'category_lookup'
  | 'customer_lookup';

export interface OptionItem {
  label: string;
  value: string;
}

export interface ThemeSettingFieldSchema {
  type: ThemeSettingBasicInputType | ThemeSettingAliasInputType;
  label: string;
  id?: string;
  default?: any;
  hint?: string;
  description?: string;
  placeholder?: string;
  value_type?: string;
  fallback?: any;
  required?: boolean;
  fields?: Array<ThemeSettingFieldSchema>;
  localized?: boolean;

  // short_text
  format?: string;

  // short_text, long_text, number, date
  min?: number;
  max?: number;

  // number
  increment?: number;
  unit?: string;
  digits?: number;

  // select, asset
  multiple?: boolean;

  // select
  options?: Array<OptionItem>;

  // asset
  asset_types?: Array<'image' | 'video' | 'document'>;

  // collection, lookup
  collection?: string;

  // collection
  item_types?: Array<string>;
  item_label?: string;
  icon?: string;
  child?: boolean;
  link?: {
    url: string;
    data?: SwellData;
    params?: SwellData;
  };

  // lookup
  collection_parent_id?: string;
  collection_parent_field?: string;
  model?: string;
  key?: string;
  key_field?: string;
  name_pattern?: string;
  query?: SwellData;
  params?: SwellData;
  limit?: number;
}

export interface ThemeSettingSectionSchema {
  id?: string;
  label: string;
  fields: ThemeSettingFieldSchema[];
}

export interface ThemePageSectionSchema extends ThemeSectionSchema {
  id: string;
}

export interface ThemeSectionGroupInfo {
  prop: string;
  label: string;
}

export interface ThemePageTemplateSectionConfig {
  type: string;
  settings: ThemeSettings;
  blocks?: ThemeSettingsBlock[];
  block_order?: string[];
}

export interface ThemePageTemplateConfig extends ThemeSectionGroupBase {
  page?: {
    title?: string;
    description?: string;
    published?: boolean;
    $locale?: SwellLocaleProp;
  };
  sections: Record<string, ThemePageTemplateSectionConfig>;
  order?: string[];
}

export interface ThemeLayoutSectionGroupConfig extends ThemePageTemplateConfig {
  id: string;
  type: string;
  label: string;
  sectionConfigs: ThemeSectionConfig[];
}

export interface ThemeBlockSchema {
  type: string;
  label: string;
  limit?: number;
  fields: ThemeSettingFieldSchema[];
}

export interface ThemePresetSchema {
  label: string;
  settings?: ThemeSettings;
  blocks?: ThemeSettingsBlock[];
}

export interface ThemeSectionEnabledDisabled {
  templates?: string[] | '*';
  groups?: string[];
}

export type GetThemeConfig = (
  fileName: string,
) => Promise<SwellThemeConfig | null>;

export type GetThemeTemplateConfigByType = (
  type: string,
  name: string,
) => Promise<SwellThemeConfig | null | undefined>;

export type GetAssetUrl = (assetPath: string) => Promise<string | null>;

export type RenderTemplate = (
  config: SwellThemeConfig | null,
  data?: SwellData,
) => Promise<string>;

export type RenderTemplateString = (
  templateString: string,
  data?: SwellData,
) => Promise<string>;

export type RenderTemplateSections = (
  sections: ThemeSectionGroup,
  data?: SwellData,
) => Promise<string>;

export type RenderTranslation = (
  key: string,
  data?: unknown,
  locale?: string,
) => Promise<string>;

interface RenderCurrencyParams {
  code?: string;
  rate?: number;
  locale?: string;
  decimals?: number;
}

export type RenderCurrency = (
  amount: number,
  params?: RenderCurrencyParams,
) => string;

export type ResolveFilePath = (fileName: string, extName?: string) => string;

export interface ThemeFontConfig {
  family: string;
  fallback?: string;
  label?: string;
  axes: Array<'wght' | 'wdth' | 'slnt' | 'opsz' | 'ital'>;
  variants: ThemeFontVariant[];
  system?: boolean;
}

export interface ThemeFontVariant {
  wght?: number;
  wdth?: number;
  slnt?: number;
  opsz?: number;
  ital?: number;
}

export interface ThemeFontVariantSetting {
  family: string;
  weight?: number;
  style?: 'normal' | 'italic' | 'oblique' | string;
  variant?: ThemeFontVariant;
}

export interface ThemeFormConfig {
  id: string;
  url: string;
  return_url?: string;
  params?: string[];
  handler?: Function;
}

export interface ThemeFormErrorMessage {
  code?: string;
  message: string;
  field_name?: string;
  field_label?: string;
}

export type ThemeFormErrorMessages = Array<ThemeFormErrorMessage>;

export type CFWorkerKVGetType = 'text' | 'json' | 'arrayBuffer' | 'stream';

export interface CFWorkerKVGetOptions<T extends CFWorkerKVGetType> {
  cacheTtl: number;
  type: T;
}

export interface CFWorkerKVGetMetadataResponse<T> {
  value: T | null;
  metadata: string | null;
}

export interface CFWorkerKVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: object;
}

export interface CFWorkerKVListOptions {
  prefix?: string;
  limit?: string;
  cursor?: string;
}

export interface CFWorkerKVKeyInfo {
  name: string;
  expiration?: number;
  metadata?: object;
}

export interface CFWorkerKVListResponse {
  keys: CFWorkerKVKeyInfo[];
  list_complete: boolean;
  cursor: string;
}

export interface CFWorkerKV {
  get(
    key: string,
    type?: 'text',
    options?: CFWorkerKVGetOptions<'text'>,
  ): Promise<string | null>;
  get(
    key: string,
    type?: 'arrayBuffer',
    options?: CFWorkerKVGetOptions<'arrayBuffer'>,
  ): Promise<ArrayBuffer | null>;
  get(
    key: string,
    type?: 'stream',
    options?: CFWorkerKVGetOptions<'stream'>,
  ): Promise<ReadableStream | null>;
  get<T>(
    key: string,
    type?: 'json',
    options?: CFWorkerKVGetOptions<'json'>,
  ): Promise<T | null>;

  getWithMetadata(
    key: string,
    type?: 'text',
    options?: CFWorkerKVGetOptions<'text'>,
  ): Promise<CFWorkerKVGetMetadataResponse<string>>;
  getWithMetadata(
    key: string,
    type?: 'arrayBuffer',
    options?: CFWorkerKVGetOptions<'arrayBuffer'>,
  ): Promise<CFWorkerKVGetMetadataResponse<ArrayBuffer>>;
  getWithMetadata(
    key: string,
    type?: 'stream',
    options?: CFWorkerKVGetOptions<'stream'>,
  ): Promise<CFWorkerKVGetMetadataResponse<ReadableStream>>;
  getWithMetadata<T>(
    key: string,
    type?: 'json',
    options?: CFWorkerKVGetOptions<'json'>,
  ): Promise<CFWorkerKVGetMetadataResponse<T>>;

  put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: CFWorkerKVPutOptions,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: CFWorkerKVListOptions): Promise<CFWorkerKVListResponse>;
}

export interface CFThemeEnv {
  THEME?: CFWorkerKV;
}
