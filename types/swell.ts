import type { FormatInput } from 'swell-js';

import type {
  SwellStorefrontRecord,
  SwellStorefrontResource,
  SwellStorefrontSingleton,
} from '../src/resources';

import type {
  Swell,
  SwellStorefrontCollection,
  StorefrontResource,
} from '../src/api';

import type {
  ShopifySettingRoleSchema,
  ShopifySettingsData,
  ShopifySettingsSchema,
} from './shopify';

export interface SwellApiParams {
  url: URL | string;
  config?: SwellAppConfig;
  shopifyCompatibilityConfig?: SwellAppShopifyCompatibilityConfig;
  headers?: Record<string, string | undefined>;
  swellHeaders?: Record<string, string | undefined>;
  serverHeaders?: Headers | Record<string, string | undefined>; // Required on the server
  queryParams?: URLSearchParams | Record<string, string | undefined>;
  workerEnv?: CFThemeEnv;
  workerCtx?: CFWorkerContext;
  isEditor?: boolean;
  getCookie?: (name: string) => string | undefined;
  setCookie?: (
    name: string,
    value: string,
    options: object | undefined,
    swell: Swell,
  ) => void;
  resourceLoadingIndicator?: (isLoading: boolean) => void;
  [key: string]: unknown;
}

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
  editor_configs?: {
    checkout_form?: string;
    redirect_to_page_start_forms?: string[];
    script_actions_routes?: Record<string, string>;
    script_routes?: Record<string, string>;
  };
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

export interface SwellSettingsGeoItem {
  id: string;
  name: string;
}

export interface SwellSettingsGeoCountry extends SwellSettingsGeoItem {
  state_label?: string;
}

export interface SwellSettingsGeoState extends SwellSettingsGeoItem {
  country: string;
}

export type SwellSettingsGeoTimezone = SwellSettingsGeoItem;
export type SwellSettingsGeoCurrency = SwellSettingsGeoItem;
export type SwellSettingsGeoLocale = SwellSettingsGeoItem;

export interface SwellSettingsGeo {
  id: 'geo';
  countries: SwellSettingsGeoCountry[];
  currencies: SwellSettingsGeoCurrency[];
  locales: SwellSettingsGeoLocale[];
  states: SwellSettingsGeoState[];
  timezones: SwellSettingsGeoTimezone[];
}

export interface SwellLocale {
  code: string;
  name: string;
  fallback?: string | null;
}

export interface SwellCurrency {
  code: string;
  decimals: number;
  name: string;
  priced: boolean;
  rate: number;
  symbol: string;
  type: string;
}

export interface SwellPageRequest {
  host: string;
  origin: string;
  path: string;
  query: QueryParams;
  locale: string;
  currency: string;
  is_editor: boolean;
  is_preview: boolean;
  design_mode?: boolean;
  visual_section_preview?: boolean;
  page_type?: string;
}

export interface SwellProductFilterOption {
  value: unknown;
  label?: string;
  count?: number;
  active?: boolean;
}

export interface SwellProductFilter {
  id: string;
  label: string;
  type: string;
  options?: SwellProductFilterOption[];
  interval?: number;
  range_min?: number;
  range_max?: number;
  param_name: string;
  active_options?: SwellProductFilterOption[];
  inactive_options?: SwellProductFilterOption[];
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

export interface SwellCollection<T extends SwellData = SwellRecord> {
  page: number;
  count: number;
  results: T[];
  page_count: number;
  limit: number;
  pages?: SwellCollectionPages;
  // Proxima
  filter_options?: SwellProductFilter[];
}

export type InferSwellCollection<T> =
  T extends SwellCollection<infer U> ? U : SwellData;

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

export interface SwellThemeVersion extends SwellRecord {
  manifest: SwellThemeManifest;
  hash: string;
}

export interface SwellThemeManifest {
  [key: string]: string;
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
  BlogCategory = 'blog_category',
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

export type QueryParams = import('qs').ParsedQs;

export type StorefrontResourceGetter<T extends SwellData = SwellData> = (
  this: SwellStorefrontResource<T>,
) => Promise<T | null> | T | null;

export type StorefrontCollectionGetter<
  T extends SwellCollection<SwellData> = SwellCollection<SwellData>,
> = (this: SwellStorefrontCollection<T>) => Promise<T | null> | T | null;

export interface ThemeSettings {
  [key: string]: any;
}

export interface ThemeSettingsBlock {
  type: string;
  settings: ThemeSettings;
  disabled?: boolean;
}

export interface ThemeSectionBase {
  id: string;
  settings: ThemeSettings;
  blocks?: ThemeSettingsBlock[];
  block_order?: string[];
  custom_css?: string | string[];
  disabled?: boolean;
}

export interface ThemeSectionSettings extends ThemeSettings {
  section: ThemeSectionBase;
}

export interface ThemePageSchema {
  layout?: string;
  page?: {
    slug?: string;
    label?: string;
    description?: string;
    $locale?: string;
  };
}

interface ThemePageAdditionalProps {
  description?: string;
  current: number;
  label: string;
  slug?: string;
  $locale?: string;
}

export interface ThemeCustomPage extends ThemePageAdditionalProps {
  custom: true;
  id: string;
}

export interface ThemeSwellPage
  extends SwellAppStorefrontThemePage,
    ThemePageAdditionalProps {
  custom: false;
}

export type ThemePage = ThemeSwellPage | ThemeCustomPage;

export interface ThemeGlobals extends SwellData {
  store: SwellData;
  settings: ThemeSettings;
  session: SwellData;
  request: SwellPageRequest;
  menus?: Record<string, SwellMenu | undefined>;
  page: ThemePage;
  cart: SwellStorefrontSingleton | {};
  account: SwellStorefrontSingleton | null;
  customer?: SwellStorefrontSingleton | null;
  geo: SwellSettingsGeo;
  configs: ThemeConfigs;
  language: Record<string, unknown>;
  canonical_url: string;
  shopify_compatibility: boolean;
  [key: string]: any;
}

export interface ThemeConfigs {
  editor: ThemeEditorConfigSchema;
  theme: ThemeSettings;
  presets: ThemePresetConfigSchema[];
  language: ThemeSettings;
  [key: string]: any;

  // Shopify compatibility
  settings_schema?: ShopifySettingsSchema;
  settings_data?: ShopifySettingsData;
}

export interface ThemeEditorConfigSchema {
  settings?: ThemeSettingSectionSchema[];
}

export interface ThemePresetConfigSchema {
  label: string;
  settings?: ThemeSettings;
}

export interface ThemeResourceFactory {
  new (swell: Swell): StorefrontResource;
}

export interface ThemeLookupResourceFactory {
  new (swell: Swell, id: string): StorefrontResource<SwellRecord>;
}

export interface ThemeResources {
  singletons?: {
    account?: ThemeResourceFactory;
    cart?: ThemeResourceFactory;
  };
  records?: Record<string, ThemeLookupResourceFactory>;
}

export interface ThemeLocaleSection {
  [key: string]: string | ThemeLocaleSection;
}

export interface ThemeLocaleConfig {
  [key: string]: ThemeLocaleSection;
}

export interface ThemeSection {
  id?: string;
  type: string;
  disabled?: boolean;
  settings: ThemeSettings;
  blocks?: Record<string, ThemeSettingsBlock>;
  block_order?: string[];
  custom_css?: string;
}

interface ThemeSectionGroupBase {
  id?: string;
  type?: string;
  label?: string;
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
  limit?: number;
  blocks?: ThemeBlockSchema[];
  presets?: ThemePresetSchema[];
  default?: ThemePresetSchema;
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
  default?: unknown;
  hint?: string;
  description?: string;
  placeholder?: string;
  value_type?: string;
  fallback?: unknown;
  required?: boolean;
  fields?: Array<ThemeSettingFieldSchema>;
  localized?: boolean;
  titleField?: string;

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

  // shopify compatibility
  role?: ShopifySettingRoleSchema;

  // swell field conditions
  conditions?: Record<string, any>;
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
  source: string;
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

export type RenderPageSections = (
  sections: ThemeSectionGroup,
  data?: SwellData,
) => Promise<ThemeSectionConfig[]>;

export type RenderTranslation = (
  key: string,
  data?: unknown,
  locale?: string,
) => Promise<string>;

export type RenderCurrency = (amount: number, params?: FormatInput) => string;

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

export interface ThemeFormConfigParam {
  name: string;
  value: string;
}

export interface ThemeFormConfig {
  id: string;
  url: string;
  return_url?: string;
  params?: ThemeFormConfigParam[];
  handler?: () => void;
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

export interface CFWorkerContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
