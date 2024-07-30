type SwellAppConfig = {
  id: string;
  name: string;
  type: 'storefront' | string;
  version: string;
  description?: string;
  properties?: SwellAppStorefrontProps;
};

type SwellAppStorefrontThemeProps = {
  type: 'theme';
  pages: Array<{
    id: string;
    url: string;
    label: string;
    group?: string;
    icon?: string;
    templates?: boolean;
    collection?: string;
  }>;
  shopify_compatibility?: boolean;
};

type SwellErrorOptions = {
  status?: number;
  method?: string;
  endpointUrl?: string;
};

type SwellData = {
  [key: string]: any;
};

type SwellLocaleProp = {
  [key: string]: {
    [key: string]: string;
  };
};

type SwellCurrencyProp = {
  [key: string]: {
    [key: string]: number;
  };
};

type SwellRecord = {
  id: string;
  [key: string]: any;
  $locale?: SwellLocaleProp;
  $currency?: SwellCurrencyProp;
};

type SwellCollection = {
  page: number;
  count: number;
  results: SwellRecord[];
  page_count: number;
  limit: number;
  pages: SwellCollectionPages;
};

type SwellCollectionPages = {
  [key: string]: {
    start: number;
    end: number;
  };
};

interface SwellThemeConfig extends SwellRecord {
  id: string;
  type: string;
  file_data: string;
  file_path: string;
}

type SwellMenu = {
  id: string;
  name: string;
  items: SwellMenuItem[];
  $locale?: SwellLocaleProp;
};

enum SwellMenuItemType {
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

type SwellMenuItem = {
  name: string;
  type: SwellMenuItemType;
  items: SwellMenuItem[];
  model?: string;
  value?:
    | string
    | {
        [key: string]: any;
      };
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
};

type StorefrontResourceGetter = () => Promise<SwellData> | SwellData;

type ShopifyPageResourceMap = Array<{
  page: string;
  resources: Array<{
    from: string;
    to: string;
    object: ShopifyResource;
  }>;
}>;

type ShopifyObjectResourceMap = Array<{
  from: any;
  object: ShopifyResource;
}>;

type ShopifyFormResourceMap = Array<{
  type: string;
  shopifyType?: string;

  clientParams?: (scope: SwellData, arg?: any) => SwellData;

  clientHtml?: (scope: SwellData, arg?: any) => string;

  serverParams?: (context: SwellData) => SwellData;

  serverResponse?: (context: SwellData) => SwellData;
}>;

type ShopifyQueryParamsMap = Array<{
  from: string | ((param: string) => boolean);
  to: string | ((param: string, value: string) => SwellData);
}>;

type ThemeSettings = {
  [key: string]: any;
};

type ThemeSettingsBlock = {
  type: string;
  settings: ThemeSettings;
};

interface ThemeSectionSettings extends ThemeSettings {
  section: {
    id: string;
    type: string;
    settings: ThemeSettings;
    blocks?: ThemeSettingsBlock[];
    block_order?: string[];
  };
}

type ThemePage = {
  [key: string]: any; // TODO: fix this
};

interface ThemeGlobals extends SwellData {
  store: SwellData;
  request: SwellData;
  settings: ThemeSettings;
  page: ThemePage;
  configs: ThemeConfigs;
  menus?: { [key: string]: SwellMenu };
  [key: string]: any;
}

type ThemeConfigs = {
  editor: ThemeEditorSchema;
  theme: ThemeSettings;
  presets: ThemePresetSchema[];
  translations: ThemeSettings;
  [key: string]: any;

  // Shopify compatibility
  settings_schema?: any;
  settings_data?: any;
};

type ThemeResources = {
  singletons?: {
    account?: StorefrontResource;
    cart?: StorefrontResource;
  };
  records?: {
    [key: string]: StorefrontResource;
  };
};

type ThemeEditorSchema = {
  settings?: ThemeSettingSectionSchema[];
  menus?: any; // TODO menu schema?
};

type ThemeSection = {
  id?: string;
  type: string;
  disabled?: boolean;
  settings: ThemeSettings;
  blocks?: {
    [key: string]: ThemeSettingsBlock;
  };
  block_order?: string[];
};

type ThemeSectionGroup = {
  id?: string;
  type?: string;
  sections: {
    [key: string]: ThemeSection;
  };
  order?: string[];
};

type ThemeSectionConfig = {
  id: string;
  section: ThemeSection;
  tag: string;
  schema?: ThemeSectionSchema | null;
  output?: string;
  settings?: ThemeSectionSettings;
  blocks?: ThemeSettingsBlock[];
  class?: string;
};

type ThemeSectionSchema = {
  id?: string;
  label: string;
  fields: ThemeSettingFieldSchema[];
  type?: string; // layout sections only
  tag?: string;
  class?: string;
  enabled_on?: ThemeSectionEnabledDisabled;
  disabled_on?: ThemeSectionEnabledDisabled;
  blocks?: ThemeBlockSchema[];
  presets?: ThemePresetSchema[];
  default?: {
    settings?: ThemeSettings;
    blocks?: ThemeSettingsBlock[];
    block_order?: string[];
  };
};

type ThemeSettingBasicInputType =
  | 'short_text'
  | 'long_text'
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

type ThemeSettingAliasInputType =
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

type ThemeSettingFieldSchema = {
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
  options?: Array<{
    label: string;
    value: string;
  }>;

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
};

type ThemeSettingSectionSchema = {
  label: string;
  id?: string;
  fields: ThemeSettingFieldSchema[];
};

interface ThemePageSectionSchema extends ThemeSectionSchema {
  id: string;
}

interface ThemePageTemplateConfig extends ThemeSectionGroup {
  page?: {
    title?: string;
    description?: string;
    published?: boolean;
    $locale?: SwellLocaleProp;
  };
  sections: {
    [key: string]: {
      type: string;
      settings: ThemeSettings;
      blocks?: ThemeSettingsBlock[];
      block_order?: string[];
    };
  };
  order?: string[];
}

interface ThemeLayoutSectionGroupConfig extends ThemePageTemplateConfig {
  id: string;
  type: string;
  label: string;
  sectionConfigs: ThemeSectionConfig[];
}

type ThemeBlockSchema = {
  type: string;
  label: string;
  limit?: number;
  fields: ThemeSettingFieldSchema[];
};

type ThemePresetSchema = {
  label: string;
  settings?: ThemeSettings;
  blocks?: ThemeSettingsBlock[];
};

type ThemeSectionEnabledDisabled = {
  templates?: string[];
  groups?: string[];
};

type GetThemeConfig = (fileName: string) => Promise<SwellThemeConfig | null>;

type GetThemeTemplateConfigByType = (
  type: string,
  name: string,
) => Promise<SwellThemeConfig | null | undefined>;

type GetAssetUrl = (assetPath: string) => string | null;

type RenderTemplate = (
  config: SwellThemeConfig | null,
  data?: any,
) => Promise<string>;

type RenderTemplateString = (
  templateString: string,
  data?: any,
) => Promise<string>;

type RenderTemplateSections = (
  sections: ThemeSectionGroup,
  data?: any,
) => Promise<string>;

type RenderTranslation = (key: string, locale?: string) => Promise<string>;

type RenderCurrency = (
  amount: number,
  params?: { code?: string; rate?: number; locale?: string; decimals?: number },
) => string;

type ResolveFilePath = (fileName: string, extName?: string) => string;

type ThemeFontConfig = {
  family: string;
  fallback?: string;
  axes: Array<'wght' | 'wdth' | 'slnt' | 'opsz' | 'ital'>;
  variants: ThemeFontVariant[];
  system?: boolean;
};

type ThemeFontVariant = {
  wght?: number;
  wdth?: number;
  slnt?: number;
  opsz?: number;
  ital?: number;
};

type ThemeFontVariantSetting = {
  family: string;
  weight?: number;
  style?: 'normal' | 'italic' | 'oblique' | string;
  variant?: ThemeFontVariant;
};

type ThemeFormConfig = {
  id: string;
  url: string;
  return_url?: string;
  params?: string[];
  handler?: Function;
};

type ThemeFormErrorMessage = {
  code?: string;
  message: string;
  field_name?: string;
  field_label?: string;
};

type ThemeFormErrorMessages = Array<ThemeFormErrorMessage>;
