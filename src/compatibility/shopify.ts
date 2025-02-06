import { get, isObject } from 'lodash-es';

import { Swell, StorefrontResource } from '@/api';
import { ThemeFont } from '@/liquid/font';
import { ThemeForm } from '@/liquid/form';
import { SwellTheme } from '@/theme';
import { extractSettingsFromForm } from '@/utils';

import {
  convertShopifySettingsSchema,
  convertShopifySettingsData,
  convertShopifySettingsPresets,
  convertShopifySectionSchema,
} from './shopify-configs';
import { shopifyFontToThemeFront } from './shopify-fonts';
import {
  adaptShopifyMenuData,
  adaptShopifyFontData,
  adaptShopifyFormData,
  ShopifyResource,
} from './shopify-objects';
import * as ShopifyObjects from './shopify-objects';
import ShopifyShop from './shopify-objects/shop';
import ShopifyLocalization from './shopify-objects/localization';

import type {
  ThemeGlobals,
  ThemeSettings,
  ThemePresetSchema,
  ThemeEditorSchema,
  ThemeSectionSchemaData,
  SwellData,
  SwellMenu,
  SwellRecord,
  SwellThemeConfig,
  SwellAppShopifyCompatibilityConfig,
} from '../../types/swell';

import type {
  ShopifySettingsData,
  ShopifySettingsSchema,
  ShopifySectionSchema,
  ShopifyPageResourceMap,
  ShopifyObjectResourceMap,
  ShopifyFormResourceMap,
  ShopifyQueryParamsMap,
} from '../../types/shopify';

/*
 * This class is meant to be extended by a storefront app to provide compatibility with Shopify's Liquid
 */
export class ShopifyCompatibility {
  public theme: SwellTheme;
  public swell: Swell;
  public pageId?: string;
  public pageResourceMap: ShopifyPageResourceMap;
  public objectResourceMap: ShopifyObjectResourceMap;
  public formResourceMap: ShopifyFormResourceMap;
  public queryParamsMap: ShopifyQueryParamsMap;
  public editorLocaleConfig: { [key: string]: any } | undefined;
  public shopifyCompatibilityConfig?: SwellAppShopifyCompatibilityConfig;

  constructor(theme: SwellTheme) {
    this.theme = theme;
    this.swell = theme.swell;
    this.shopifyCompatibilityConfig =
      this.swell.shopifyCompatibilityConfig ?? undefined;

    this.pageResourceMap = this.getPageResourceMap();
    this.objectResourceMap = this.getObjectResourceMap();
    this.formResourceMap = this.getFormResourceMap();
    this.queryParamsMap = this.getQueryParamsMap();
  }

  adaptGlobals(globals: ThemeGlobals) {
    const { store, request, page, menus } = globals;

    this.pageId = this.getPageType(page?.id);

    globals.shop = this.getShopData(globals);

    /*
     * Note: page is used both globally and in content pages
     * https://shopify.dev/docs/api/liquid/objects/page
     */
    globals.page = {
      ...(page || undefined),
    };

    globals.request = {
      ...(request || undefined),
      design_mode: this.swell.isEditor,
      visual_section_preview: false, // TODO: Add support for visual section preview
      page_type: page?.id,
    };

    globals.linklists = menus;

    globals.current_page = this.swell.queryParams.page || 1;

    globals.routes = this.getPageRoutes();

    globals.localization = this.getLocalizationObject(store, request);

    globals.all_country_option_tags = this.getAllCountryOptionTags(globals.geo);
  }

  /**
   * Extracts values from the form according to the passed settings config
   *
   * @input
   * ```js
   * form = {
   *   field1: { value: 'value1' },
   *   field2: { value: 'value2' },
   *   field3: { value: null },
   *   extra: { value: 'value3' },
   * }
   * config = {
   *   current: {
   *     field1: 'old1',
   *     field2: 'old2',
   *     field3: 'old3',
   *     field4: 'old4',
   *   },
   *   presets: {},
   * }
   * ```
   *
   * @output
   * ```js
   * return {
   *   current: {
   *     field1: 'value1',
   *     field2: 'value2',
   *     field3: 'old3',
   *     field4: 'old4',
   *   },
   *   presets: {},
   * }
   * ```
   */
  adaptSettings(
    form: Record<string, { value: unknown } | undefined>,
    config: ShopifySettingsData,
  ) {
    const { current, presets } = config;

    // `current` can be a preset object
    if (typeof current === 'object' && current) {
      return {
        current: extractSettingsFromForm(form, current),
        presets,
      };
    }

    // Or the `current` one can be a string key
    const preset = presets?.[current];

    if (!preset) {
      throw new Error(
        `Failed to build settings config: "${current}" preset is not defined`,
      );
    }

    return {
      current,
      presets: {
        ...presets,
        [current]: extractSettingsFromForm(form, preset),
      },
    };
  }

  adaptPageData(pageData: SwellData) {
    const pageMap = this.pageResourceMap.find(
      ({ page }) => page === this.pageId,
    );

    // Add object resources to the page based on the page resource map
    if (pageMap) {
      for (const [key, value] of Object.entries(pageData)) {
        const resourceMap = pageMap.resources.find(({ from }) => from === key);
        if (resourceMap && value instanceof StorefrontResource) {
          pageData[resourceMap.to] = resourceMap.object(this, value);
        }
      }
    }

    this.adaptObjectData(pageData);
  }

  adaptObjectData(objectData: SwellData) {
    // Adapt individual resources to Shopify objects from page data
    for (const value of Object.values(objectData)) {
      const objectMap = this.objectResourceMap.find(
        ({ from }) => from === value?.constructor.name,
      );

      if (objectMap) {
        const objectProps = objectMap.object(this, value);
        if (value instanceof StorefrontResource) {
          value.setCompatibilityProps(objectProps);
        } else {
          Object.assign(value, objectProps);
        }
      }
    }
  }

  adaptQueryParams() {
    // Adapt query params from Shopify to Swell compatible format
    const adaptedParams: SwellData = {};
    for (const [key, value] of Object.entries(this.swell.queryParams)) {
      const paramMap = this.queryParamsMap.find(({ from }) =>
        typeof from === 'function' ? from(key) : from === key,
      );
      if (paramMap) {
        const toObject =
          typeof paramMap.to === 'function'
            ? paramMap.to(key, value)
            : { [paramMap.to]: value };
        Object.assign(adaptedParams, toObject);
      } else {
        adaptedParams[key] = value;
      }
    }

    this.swell.queryParams = adaptedParams;
  }

  getAdaptedFormType(shopifyType: string) {
    const formMap = this.formResourceMap.find(
      (form) => form.shopifyType === shopifyType,
    );
    return formMap?.type;
  }

  async getAdaptedFormClientParams(
    formType: string,
    scope: SwellData,
    arg?: any,
  ) {
    const formMap = this.formResourceMap.find((form) => form.type === formType);
    if (formMap?.clientParams) {
      return await formMap.clientParams(scope, arg);
    }
  }

  async getAdaptedFormClientHtml(
    formType: string,
    scope: SwellData,
    arg?: any,
  ) {
    const formMap = this.formResourceMap.find((form) => form.type === formType);
    const formTypeConfig = this.shopifyCompatibilityConfig?.forms?.find(
      (form) => form.id === formType,
    );

    if (formMap && formTypeConfig) {
      return formTypeConfig.client_params?.reduce((acc: any, param: any) => {
        return (
          `<input type="hidden" name="${param.name}" value="${param.value}" />` +
          acc
        );
      }, ``);
    }
  }

  async getAdaptedFormServerParams(formType: string, context: SwellData) {
    const formMap = this.formResourceMap.find(
      (form) => form.type === formType || form.shopifyType === formType,
    );
    if (typeof formMap?.serverParams === 'function') {
      return formMap.serverParams(context);
    }
  }

  async getAdaptedFormServerResponse(formType: string, context: SwellData) {
    const formMap = this.formResourceMap.find(
      (form) => form.type === formType || form.shopifyType === formType,
    );
    if (typeof formMap?.serverResponse === 'function') {
      return await formMap.serverResponse(context);
    }
  }

  getShopData({ store }: ThemeGlobals) {
    if (store) {
      return ShopifyShop(this, store);
    }
    return {};
  }

  getContentForHeader() {
    return `<script>var Shopify = Shopify || {};</script>`;
  }

  getMenuData(menu: SwellMenu): SwellData {
    return adaptShopifyMenuData(this, menu);
  }

  getFontData(font: ThemeFont): SwellData {
    return adaptShopifyFontData(this, font);
  }

  getFormData(form: ThemeForm): SwellData {
    return adaptShopifyFormData(this, form);
  }

  getFontFromShopifySetting(fontSetting: string) {
    return shopifyFontToThemeFront(fontSetting);
  }

  getThemeConfig(settingsData: ShopifySettingsData): ThemeSettings {
    return convertShopifySettingsData(settingsData);
  }

  getPresetsConfig(settingsData: ShopifySettingsData): ThemePresetSchema[] {
    return convertShopifySettingsPresets(settingsData);
  }

  getEditorConfig(settingsSchema: ShopifySettingsSchema): ThemeEditorSchema {
    return convertShopifySettingsSchema(settingsSchema);
  }

  getSectionConfigSchema(
    sectionSchema: ShopifySectionSchema,
  ): ThemeSectionSchemaData {
    return convertShopifySectionSchema(sectionSchema);
  }

  async getLocaleConfig(
    theme: SwellTheme,
    localeCode = 'en',
    suffix = '.json',
  ) {
    const settingConfigs = await theme.getAllThemeConfigs();

    const shopifyLocaleConfigs = new Map<string, SwellThemeConfig>();

    for (const config of settingConfigs.values()) {
      if (
        config.file_path.startsWith('theme/locales/') &&
        config.file_path.endsWith(suffix)
      ) {
        shopifyLocaleConfigs.set(config.file_path, config);
      }
    }

    let localeConfig: SwellThemeConfig | null =
      shopifyLocaleConfigs.get(`theme/locales/${localeCode}${suffix}`) ?? null;

    if (!localeConfig) {
      // Fall back to short code locale
      const localeShortCode = localeCode.split('-')[0];

      localeConfig =
        shopifyLocaleConfigs.get(`theme/locales/${localeShortCode}${suffix}`) ??
        null;

      if (!localeConfig) {
        // Fall back to default locale
        const defaultLocale = `.default${suffix}`;

        for (const config of shopifyLocaleConfigs.values()) {
          if (config.file_path.endsWith(defaultLocale)) {
            localeConfig = config;
            break;
          }
        }
      }
    }

    if (localeConfig) {
      localeConfig = await theme.getThemeConfig(localeConfig.file_path);

      try {
        return JSON.parse(localeConfig?.file_data || '');
      } catch {
        // noop
      }
    }

    return {};
  }

  async getEditorLocaleConfig(theme: SwellTheme, localeCode: string) {
    if (this.editorLocaleConfig?.[localeCode]) {
      return this.editorLocaleConfig[localeCode];
    }

    const editorLocaleConfig = await this.getLocaleConfig(
      theme,
      localeCode,
      '.schema.json',
    );

    this.editorLocaleConfig = { [localeCode]: editorLocaleConfig };

    return editorLocaleConfig;
  }

  async renderSchemaTranslations(
    theme: SwellTheme,
    schema: SwellData,
    localeCode: string = 'en',
  ): Promise<any> {
    if (!isObject(schema)) {
      return schema;
    }

    const editorLocaleConfig = await this.getEditorLocaleConfig(
      theme,
      localeCode,
    );

    return await this.renderSchemaTranslationValue(
      theme,
      schema,
      localeCode,
      editorLocaleConfig,
    );
  }

  async renderSchemaTranslationValue(
    theme: SwellTheme,
    schemaValue: any,
    localCode: string,
    editorLocaleConfig: any,
  ): Promise<any> {
    if (typeof schemaValue === 'string') {
      if (schemaValue.startsWith('t:')) {
        const key = schemaValue.slice(2);
        const keyParts = key?.split('.');
        const keyName = keyParts.pop() || '';
        const keyPath = keyParts.join('.');
        const langObject = get(editorLocaleConfig, keyPath);

        return langObject?.[keyName] ?? key;
      }
    } else if (schemaValue instanceof Array) {
      const result = [];
      for (const value of schemaValue) {
        result.push(
          await this.renderSchemaTranslationValue(
            theme,
            value,
            localCode,
            editorLocaleConfig,
          ),
        );
      }
      return result;
    } else if (isObject(schemaValue)) {
      const result: any = { ...schemaValue };
      for (const [key, value] of Object.entries(schemaValue)) {
        result[key] = await this.renderSchemaTranslationValue(
          theme,
          value,
          localCode,
          editorLocaleConfig,
        );
      }
      return result;
    }

    return schemaValue;
  }

  /*
   * Override these methods for app compatibility implementation
   */

  getPageType(pageId: string) {
    return this.shopifyCompatibilityConfig?.page_types?.[pageId] || pageId;
  }

  getPageRouteUrl(pageId: string): string {
    return (
      this.theme.props.pages?.find((page: any) => page.id === pageId)?.url ||
      pageId
    );
  }

  getPageRoutes() {
    const routes = {
      account_addresses_url: this.getPageRouteUrl('account/addresses'),
      account_login_url: this.getPageRouteUrl('account/login'),
      account_logout_url: this.getPageRouteUrl('account/logout'),
      account_recover_url: this.getPageRouteUrl('account/recover'),
      account_register_url: this.getPageRouteUrl('account/signup'),
      account_url: this.getPageRouteUrl('account/index'),
      all_products_collection_url: this.getPageRouteUrl('products/index'),
      cart_add_url: this.getPageRouteUrl('cart/add'),
      cart_change_url: this.getPageRouteUrl('cart/change'),
      cart_clear_url: this.getPageRouteUrl('cart/clear'),
      cart_update_url: this.getPageRouteUrl('cart/update'),
      cart_url: this.getPageRouteUrl('cart/index'),
      collections_url: this.getPageRouteUrl('categories/index'),
      predictive_search_url: this.getPageRouteUrl('search/suggest'),
      product_recommendations_url: this.getPageRouteUrl('products/index'),
      root_url: this.getPageRouteUrl('index'),
      search_url: this.getPageRouteUrl('search'),
    };

    if (this.shopifyCompatibilityConfig?.page_routes) {
      for (const [key, value] of Object.entries(
        this.shopifyCompatibilityConfig.page_routes,
      )) {
        if (value && typeof value === 'object' && value.page_id) {
          (routes as any)[key] = this.getPageRouteUrl(value.page_id);
        } else if (typeof value === 'string') {
          (routes as any)[key] = value;
        }
      }
    }

    return routes;
  }

  getLocalizationObject(store: SwellData, request: SwellData) {
    return ShopifyLocalization(this, store, request);
  }

  getAdaptedPageUrl(url: string) {
    if (!url) return;

    let pageId;
    let pageExt;
    const urlParams: SwellData = {};

    const [pathname, query] = url.split('?');
    const pathExtParts = pathname.split('.');
    const ext = pathExtParts[1] ? pathExtParts.pop() : null;
    const [_, segment1, segment2, segment3] = pathExtParts.join('.').split('/');

    if (ext === 'js') {
      pageExt = 'json';
    }

    switch (segment1) {
      case 'account':
        switch (segment2) {
          case 'order':
            pageId = 'account/order';
            urlParams.id = segment3;
            break;
          case 'register':
            pageId = 'account/login';
            break;
          default:
            break;
        }
        break;

      case 'blog':
        if (segment2) {
          pageId = 'blogs/category';
          urlParams.category = segment2;
        }
        if (segment3) {
          pageId = 'blogs/blog';
          urlParams.slug = segment3;
        }
        break;

      case 'collections':
        if (segment2) {
          if (segment2 === 'all') {
            pageId = 'products/index';
          } else {
            pageId = 'categories/category';
            urlParams.slug = segment2;
          }
        } else {
          pageId = 'categories/index';
        }
        break;

      case 'gift_card':
        if (segment2) {
          pageId = 'gift-card';
          urlParams.code = segment2;
        }
        break;
    }

    if (pageId) {
      const pageUrl = this.getPageRouteUrl(pageId);
      if (pageUrl) {
        // TODO: replace with pathToRegexp
        const adaptedUrl = pageUrl.replace(
          /:(\w+)/g,
          (_match, key) => urlParams[key],
        );
        return adaptedUrl + (ext ? `.${ext}` : '') + (query ? `?${query}` : '');
      }
    } else if (pageExt) {
      return (
        pathname.replace(new RegExp(`.${ext}$`), `.${pageExt}`) +
        (query ? `?${query}` : '')
      );
    }
  }

  getThemeFilePath(type: string, name: string) {
    switch (type) {
      case 'assets':
        return `assets/${name}`;
      case 'components':
        return `snippets/${name}`;
      case 'config':
        return `config/${name}`;
      case 'layouts':
        return `layout/${name}`;
      case 'templates':
        return `templates/${this.getPageType(name)}`;
      case 'sections':
        return `sections/${name}`;
      default:
        throw new Error(`Theme file type not supported: ${type}`);
    }
  }

  getPageResourceMap(): ShopifyPageResourceMap {
    if (!this.shopifyCompatibilityConfig?.page_resources) {
      return [];
    }

    return this.shopifyCompatibilityConfig.page_resources.map((item) => ({
      page: item.page,
      resources: item.resources.map(({ from, to, object }) => {
        const shopifyObject =
          ShopifyObjects[object as keyof typeof ShopifyObjects];

        if (!shopifyObject) {
          throw new Error(`ShopifyObject for '${object}' not found.`);
        }

        return {
          from,
          to,
          object: shopifyObject as (
            shopify: ShopifyCompatibility,
            value: StorefrontResource<SwellData>,
          ) => ShopifyResource,
        };
      }),
    }));
  }

  getObjectResourceMap(): ShopifyObjectResourceMap {
    if (!this.shopifyCompatibilityConfig?.object_resources) {
      return [];
    }

    return this.shopifyCompatibilityConfig.object_resources.map((item) => {
      const shopifyObject =
        ShopifyObjects[item.object as keyof typeof ShopifyObjects];

      if (!shopifyObject) {
        throw new Error(`ShopifyObject for '${item.object}' not found.`);
      }

      return {
        from: item.from,
        object: shopifyObject as (
          shopify: ShopifyCompatibility,
          value: StorefrontResource<SwellData>,
        ) => ShopifyResource,
      };
    });
  }

  getFormResourceMap(): ShopifyFormResourceMap {
    if (this.shopifyCompatibilityConfig?.forms) {
      return this.shopifyCompatibilityConfig.forms.map((form) => ({
        shopifyType: form.shopify_type,
        type: form.id,
      }));
    }
    return [];
  }

  getQueryParamsMap(): ShopifyQueryParamsMap {
    return [
      {
        from: 'sort_by',
        to: 'sort',
      },
      {
        from: (param: string) => param.startsWith('filter.v.'),
        to: (param: string, value: string) => {
          const filterKey = param.split('filter.v.')[1];
          const filterValue = value;

          return { [filterKey]: filterValue };
        },
      },
    ];
  }

  getAllCountryOptionTags(geoSettings: SwellRecord) {
    return geoSettings?.countries
      ?.map((country: any) => {
        if (!country) return;

        const provinces = [
          ...(geoSettings?.states || [])
            .filter((state: any) => state.country === country.id)
            .map((state: any) => [state.id, state.name]),
        ];
        const provincesEncoded = JSON.stringify(provinces).replace(
          /"/g,
          '&quot;',
        );

        return `<option value="${country.id}" data-provinces="${provincesEncoded}">${country.name}</option>`;
      })
      .filter(Boolean)
      .join('\n');
  }

  // returns true if this URL is used for script actions
  isScriptFormActionUrl(url: string): boolean {
    if (!url) {
      return false;
    }

    const routes =
      this.shopifyCompatibilityConfig?.editor_configs?.script_actions_routes ||
      {};

    for (const value of Object.values(routes)) {
      if (url === value) {
        return true;
      }
    }

    return false;
  }

  // returns true if this URL is used from scripts
  isScriptUrl(url: string): boolean {
    if (!url) {
      return false;
    }

    const routes =
      this.shopifyCompatibilityConfig?.editor_configs?.script_routes || {};

    for (const value of Object.values(routes)) {
      if (url.startsWith(value)) {
        return true;
      }
    }

    return false;
  }

  // returns true if we should redirect to page start (#) after this action
  needRedirectToPageStart(formId: string): boolean {
    if (!formId) {
      return false;
    }
    const formIds =
      this.shopifyCompatibilityConfig?.editor_configs
        ?.redirect_to_page_start_forms || [];
    return formIds.includes(formId);
  }

  // returns true for checkout action
  isCheckoutForm(formId: string): boolean {
    if (!formId) {
      return false;
    }

    return (
      this.shopifyCompatibilityConfig?.editor_configs?.checkout_form === formId
    );
  }
}
