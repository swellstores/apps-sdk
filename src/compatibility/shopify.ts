import get from 'lodash/get';
import isObject from 'lodash/isObject';
import { Swell, StorefrontResource } from '../api';
import { SwellTheme } from '../theme';
import { ThemeFont } from '../liquid/font';
import { ThemeForm } from '../liquid/form';
import ShopifyShop from './shopify-objects/shop';
import {
  adaptShopifyMenuData,
  adaptShopifyLookupData,
  adaptShopifyFontData,
  adaptShopifyFormData,
} from './shopify-objects';
import {
  convertShopifySettingsSchema,
  convertShopifySettingsData,
  convertShopifySettingsPresets,
  convertShopifySectionSchema,
} from './shopify-configs';
import { shopifyFontToThemeFront } from './shopify-fonts';

/*
 * This class is meant to be extended by a storefront app to provide compatibility with Shopify's Liquid
 */
export class ShopifyCompatibility implements ShopifyCompatibility {
  public swell: Swell;
  public pageId?: string;
  public pageResourceMap: ShopifyPageResourceMap;
  public objectResourceMap: ShopifyObjectResourceMap;
  public formResourceMap: ShopifyFormResourceMap;
  public queryParamsMap: ShopifyQueryParamsMap;
  public editorLocaleConfig: { [key: string]: any } | undefined;

  constructor(swell: Swell) {
    this.swell = swell;
    this.pageResourceMap = this.getPageResourceMap();
    this.objectResourceMap = this.getObjectResourceMap();
    this.formResourceMap = this.getFormResourceMap();
    this.queryParamsMap = this.getQueryParamsMap();
  }

  adaptGlobals(globals: ThemeGlobals) {
    const { store, page, menus } = globals;

    this.pageId = this.getPageType(page?.id);

    globals.shop = this.getShopData(globals);

    /*
     * Note: page is used both globally and in content pages
     * https://shopify.dev/docs/api/liquid/objects/page
     */
    globals.page = {
      ...(page || undefined),
      id: this.pageId,
      url: this.swell.url.pathname,
    };

    globals.request = {
      host: this.swell.url.host,
      origin: this.swell.url.origin,
      path: this.swell.url.pathname,
      query: this.swell.queryParams,
      locale: store?.locale,
      design_mode: this.swell.isEditor,
      visual_section_preview: false, // TODO: Add support for visual section preview
      page_type: page?.id,
    };

    globals.linklists = menus;

    globals.current_page = 1; // TODO: pagination page

    globals.routes = this.getPageRoutes();

    globals.all_country_option_tags = this.getAllCountryOptionTags(globals.geo);
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
        ({ from }: { from: any }) => value instanceof from,
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

  async getAdaptedFormClientParams(
    formType: string,
    scope: SwellData,
    arg?: any,
  ) {
    const formMap = this.formResourceMap.find(
      (form) => form.formType === formType,
    );
    if (formMap?.clientParams) {
      return await formMap.clientParams(scope, arg);
    }
  }

  async getAdaptedFormClientHtml(
    formType: string,
    scope: SwellData,
    arg?: any,
  ) {
    const formMap = this.formResourceMap.find(
      (form) => form.formType === formType,
    );
    if (formMap?.clientHtml) {
      return await formMap.clientHtml(scope, arg);
    }
  }

  async getAdaptedFormServerParams(
    pageId: string,
    formType: string | undefined,
    context: SwellData,
  ) {
    const formMap = this.formResourceMap.find(
      (form) =>
        (pageId && form.pageId === pageId) ||
        (formType && form.formType === formType),
    );
    if (formMap?.serverParams) {
      return formMap.serverParams(context);
    }
  }

  async getAdaptedFormServerResponse(
    pageId: string,
    formType: string | undefined,
    context: SwellData,
  ) {
    const formMap = this.formResourceMap.find(
      (form) =>
        (pageId && form.pageId === pageId) ||
        (formType && form.formType === formType),
    );
    if (formMap?.serverResponse) {
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

  getLookupData(
    collection: string,
    setting: ThemeSettingFieldSchema,
    value: any,
    defaultHandler: () => SwellData | null,
  ): SwellData | null {
    return adaptShopifyLookupData(
      this,
      collection,
      setting,
      value,
      defaultHandler,
    );
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
  ): ThemeSectionSchema {
    return convertShopifySectionSchema(sectionSchema);
  }

  async getLocaleConfig(
    theme: SwellTheme,
    localeCode: string = 'en',
    suffix = '.json',
  ) {
    const settingConfigs = await theme.getAllThemeConfigs();

    const shopifyLocaleConfigs = settingConfigs?.results?.filter(
      (config: SwellRecord) =>
        config?.file_path?.startsWith('theme/locales/') &&
        config?.file_path?.endsWith(suffix),
    );

    let localeConfig = shopifyLocaleConfigs?.find(
      (config: SwellRecord) =>
        config?.file_path === `theme/locales/${localeCode}${suffix}`,
    ) as SwellThemeConfig;

    if (!localeConfig) {
      // Fall back to short code locale
      const localeShortCode = localeCode.split('-')[0];
      localeConfig = shopifyLocaleConfigs?.find(
        (config: SwellRecord) =>
          config?.file_path === `theme/locales/${localeShortCode}${suffix}`,
      ) as SwellThemeConfig;

      if (!localeConfig) {
        // Fall back to default locale
        localeConfig = shopifyLocaleConfigs?.find((config: SwellRecord) =>
          config?.file_path?.endsWith(`.default${suffix}`),
        ) as SwellThemeConfig;
      }
    }

    if (localeConfig) {
      localeConfig = (await theme.getThemeConfig(
        localeConfig.file_path,
      )) as SwellThemeConfig;
      try {
        return JSON.parse(localeConfig?.file_data);
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

  async renderSchemaLanguage(
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

    return await this.renderSchemaLanguageValue(
      theme,
      schema,
      localeCode,
      editorLocaleConfig,
    );
  }

  async renderSchemaLanguageValue(
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
          await this.renderSchemaLanguageValue(
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
        result[key] = await this.renderSchemaLanguageValue(
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
    return pageId;
  }

  getPageRouteUrl(pageId: string) {
    return pageId;
  }

  getPageRoutes() {
    return {
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
  }

  getAdaptedPageUrl(url: string) {
    let pageId;
    const urlParams: SwellData = {};

    const [_, segment1, segment2, segment3] = url.split('?')[0].split('/');

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
          urlParams.id = segment2;
        }
        break;
    }

    if (pageId) {
      const pageUrl = this.getPageRouteUrl(pageId);
      if (pageUrl) {
        return pageUrl.replace(/{(\w+)}/g, (_match, key) => urlParams[key]);
      }
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
      case 'pages':
        return `templates/${this.getPageType(name)}`;
      case 'sections':
        return `sections/${name}`;
      default:
        throw new Error(`Theme file type not supported: ${type}`);
    }
  }

  getPageResourceMap(): ShopifyPageResourceMap {
    return [];
  }

  getObjectResourceMap(): ShopifyObjectResourceMap {
    return [];
  }

  getFormResourceMap(): ShopifyFormResourceMap {
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
    return this.swell.getCachedSync(
      'shopify-country-option-tags',
      [geoSettings?.countries, geoSettings?.states],
      () =>
        geoSettings?.countries
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
          .join('\n'),
    );
  }
}
