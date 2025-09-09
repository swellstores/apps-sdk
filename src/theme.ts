import JSON5 from 'json5';
import { get, each, find, reduce, cloneDeep } from 'lodash-es';

import {
  Swell,
  StorefrontResource,
  SwellStorefrontCollection,
  SwellStorefrontRecord,
  SwellStorefrontSingleton,
} from './api';
import { ShopifyCompatibility } from './compatibility/shopify';
import ShopifyTemplate from './compatibility/shopify-objects/template';
import ShopifyCart from './compatibility/shopify-objects/cart';
import ShopifyCustomer from './compatibility/shopify-objects/customer';
import RenderDrop from './liquid/drops/render';
import { GEO_DATA } from './constants';
import { LiquidSwell, ThemeColor, ThemeFont, ThemeForm } from './liquid';
import { resolveMenuSettings } from './menus';
import { ThemeLoader } from './theme/theme-loader';
import type { PutFilesResult } from './cache';
import {
  SECTION_GROUP_CONTENT,
  getSectionGroupProp,
  getAllSections,
  getPageSections,
  getLayoutSectionGroups,
  isObject,
  extractSettingsFromForm,
  scopeCustomCSS,
  getSectionLocation,
} from './utils';

import { logger, createTraceId } from './utils/logger';

import {
  POWERED_BY_LINK,
  getRecordGlobals,
  getAllCountryOptionTags,
  getRobotsGlobals,
} from './globals';

import type { FormatInput } from 'swell-js';
import type {
  ShopifySectionSchema,
  ShopifySettingsData,
} from '../types/shopify';
import type {
  ThemeGlobals,
  ThemeConfigs,
  ThemeSettings,
  ThemeResources,
  ThemeFormConfig,
  ThemeInitGlobalsOptions,
  ThemeFormErrorMessages,
  ThemeLocaleConfig,
  ThemePresetSchema,
  ThemeSectionGroup,
  ThemeSectionGroupInfo,
  ThemeSectionSchema,
  ThemeSectionConfig,
  ThemeSectionSettings,
  ThemeSettingFieldSchema,
  ThemeSettingSectionSchema,
  ThemeSettingsBlock,
  ThemePage,
  ThemePageSchema,
  ThemePageSectionSchema,
  ThemePageTemplateConfig,
  ThemeLayoutSectionGroupConfig,
  SwellData,
  SwellMenu,
  SwellRecord,
  SwellAppConfig,
  SwellThemeConfig,
  SwellThemePreload,
  SwellAppStorefrontThemeProps,
  SwellAppShopifyCompatibilityConfig,
  SwellPageRequest,
  SwellSettingsGeo,
} from '../types/swell';

export class SwellTheme {
  public swell: Swell;
  public props: SwellAppStorefrontThemeProps;
  public globals: ThemeGlobals;
  public forms?: ThemeFormConfig[];
  public resources?: ThemeResources;
  public liquidSwell: LiquidSwell;

  public themeLoader: ThemeLoader;

  public page?: ThemePage;
  public pageId: string | undefined;
  public shopifyCompatibility: ShopifyCompatibility | null = null;
  public shopifyCompatibilityClass: typeof ShopifyCompatibility =
    ShopifyCompatibility;
  public shopifyCompatibilityConfig: SwellAppShopifyCompatibilityConfig | null =
    null;

  public formData: Record<string, ThemeForm> = {};
  public globalData: SwellData = {};

  // Swell-native theme settings if not using Shopify compatibility
  public themeSettingFilePath = 'theme/config/theme.json';

  private pageSectionGroups: ThemeSectionGroupInfo[] | null = null;

  constructor(
    swell: Swell,
    options: {
      forms?: ThemeFormConfig[];
      resources?: ThemeResources;
      globals?: ThemeGlobals;
      shopifyCompatibilityClass?: typeof ShopifyCompatibility;
    } = {},
  ) {
    const { forms, resources, globals, shopifyCompatibilityClass } = options;

    this.swell = swell;
    this.props = this.getSwellAppThemeProps(swell.config);
    this.shopifyCompatibilityConfig = swell.shopifyCompatibilityConfig || null;

    this.globals = globals || ({} as ThemeGlobals);
    this.forms = forms;
    this.resources = resources;
    this.shopifyCompatibilityClass =
      shopifyCompatibilityClass || ShopifyCompatibility;

    this.liquidSwell = new LiquidSwell({
      theme: this,
      getThemeConfig: this.getThemeConfig.bind(this),
      getAssetUrl: this.getAssetUrl.bind(this),
      getThemeTemplateConfigByType:
        this.getThemeTemplateConfigByType.bind(this),
      renderTemplate: this.renderTemplate.bind(this),
      renderTemplateString: this.renderTemplateString.bind(this),
      renderPageSections: this.renderPageSections.bind(this),
      renderTranslation: this.lang.bind(this),
      renderCurrency: this.renderCurrency.bind(this),
      isEditor: swell.isEditor,
    });

    this.themeLoader = new ThemeLoader(swell);
  }

  /**
   * Getter for theme configs - returns the configs from the loader.
   * Used by editor and tests to access loaded configs.
   */
  get themeConfigs(): Map<string, SwellThemeConfig> | null {
    const configs = this.themeLoader.getConfigs();
    return configs.size > 0 ? configs : null;
  }

  /**
   * Setter for theme configs - directly sets configs in the loader.
   * Used by editor and tests to inject configs without API/KV loading.
   */
  set themeConfigs(configs: Map<string, SwellThemeConfig> | null) {
    if (configs) {
      this.themeLoader.setConfigs(configs);
    }
  }

  getSwellAppThemeProps(
    swellConfig?: SwellAppConfig,
  ): SwellAppStorefrontThemeProps {
    return (
      swellConfig?.storefront?.theme || ({} as SwellAppStorefrontThemeProps)
    );
  }

  async initGlobals(
    pageId: string,
    options?: ThemeInitGlobalsOptions,
  ): Promise<void> {
    this.pageId = pageId;

    const pageRecord = options?.pageRecord;
    const altTemplate = options?.altTemplate;

    const trace = createTraceId();
    logger.debug('[SDK] Theme init start', { page: pageId, trace });

    await this.themeLoader.init(this.themeConfigs || undefined);
    logger.debug('[SDK] ThemeLoader init done', { page: pageId, trace });

    const { store, session, menus, geo, configs, storefrontSettings } =
      await this.getSettingsAndConfigs();
    logger.debug('[SDK] Theme settings load done', { page: pageId, trace });

    const { settings, request, page, cart, account, customer } =
      await this.resolvePageData(store, configs, pageId, altTemplate);
    logger.debug('[SDK] Theme page data load done', { page: pageId, trace });

    this.page = page;

    const countryOptions = getAllCountryOptionTags(geo);

    const globals: ThemeGlobals = {
      ...this.globalData,
      // return all storefront settings in the store
      store: { ...storefrontSettings, ...store },
      settings,
      session,
      request,
      menus,
      page,
      cart,
      account,
      customer,
      geo,
      configs,
      language: configs?.language,
      ...(pageRecord
        ? getRecordGlobals(this, pageRecord)
        : {
            page_title: page.title,
            page_description: page.description,
          }),
      all_country_option_tags: countryOptions,
      country_option_tags: countryOptions,
      canonical_url: `${store.url}${this.swell.url?.pathname || ''}`,
      powered_by_link: POWERED_BY_LINK,
      // Flag to enable Shopify compatibility in sections and tags/filters
      shopify_compatibility: Boolean(settings.shopify_compatibility),
    };

    switch (pageId) {
      case 'robots.txt':
        globals.robots = getRobotsGlobals(globals.canonical_url);
        break;

      default:
        break;
    }

    if (this.shopifyCompatibility) {
      this.shopifyCompatibility.initGlobals(globals);
    }

    this.setGlobals(globals);

    if (this.shopifyCompatibility) {
      this.shopifyCompatibility.adaptQueryParams();
    }

    logger.debug('[SDK] Theme init end', { page: pageId, trace });
  }

  setGlobals(globals: Partial<ThemeGlobals>): void {
    if (this.shopifyCompatibility) {
      this.shopifyCompatibility.adaptGlobals(globals, this.globals);
    }

    this.globals = {
      ...this.globals,
      ...globals,
    };

    this.liquidSwell.options.globals = {
      ...this.globals,
    };
  }

  async getSettingsAndConfigs(): Promise<{
    store: SwellData;
    session: SwellData;
    menus: Record<string, SwellMenu | undefined>;
    geo: SwellSettingsGeo;
    configs: ThemeConfigs;
    storefrontSettings: SwellData;
  }> {
    const geo = GEO_DATA;

    // Get storefront settings asynchronously
    const storefrontSettings = await this.swell.getStorefrontSettings();

    // Get theme configs synchronously from pre-loaded data
    const settingConfigs = this.getThemeConfigsByPath('theme/config/', '.json');

    const configs: ThemeConfigs = {
      theme: {},
      editor: {},
      language: {},
      presets: [],
      ...Array.from(settingConfigs.values()).reduce(
        (acc, config) => {
          const configName = String(config?.name || '').split('.')[0];
          if (configName && config?.file_data) {
            let configValue: unknown;
            try {
              configValue = JSON5.parse<unknown>(config.file_data);
            } catch (err) {
              logger.error(`Error parsing config`, err, { configName });
              configValue = {};
            }
            acc[configName] = configValue;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      ),
    };

    // get all settings that should be localized
    // These requests should get already loaded settings and not trigger endpoints if the setting exist
    const [session, storeSettings] = await Promise.all([
      storefrontSettings.session(),
      storefrontSettings.get(),
    ]);

    // Maintain backward compatibility for a few theme versions
    // TODO: remove this in the near future
    if (configs.translations) {
      configs.language = configs.translations;
    }

    if (Object.keys(configs.language).length > 0) {
      configs.language = this.resolveTranslationLocale(configs.language);
    } else {
      const { locale } = this.swell.getStorefrontLocalization();
      configs.language = await this.getLocaleConfig(locale);
    }

    await this.setCompatibilityConfigs(configs);

    // Resolve menus after compatibility is determined
    const menus = await this.resolveMenuSettings();

    return {
      store: storeSettings?.store,
      session,
      menus,
      geo,
      configs,
      // all settings
      storefrontSettings,
    };
  }

  async resolvePageData(
    store: SwellData,
    configs: ThemeConfigs,
    pageId?: string,
    altTemplate?: string,
  ): Promise<{
    settings: ThemeSettings;
    request: SwellPageRequest;
    page: ThemePage;
    cart: SwellStorefrontSingleton;
    account: SwellStorefrontSingleton | null;
    customer?: SwellStorefrontSingleton | null;
  }> {
    const configVersion = String(
      this.swell.swellHeaders['theme-config-version'],
    );

    // Cache normalized theme settings.
    const settings = await this.swell.getCachedResource<ThemeSettings>(
      `theme-settings-resolved:v@${configVersion}`,
      [],
      () => {
        if (configs.editor?.settings) {
          fillDefaultThemeSettings(configs.theme, configs.editor?.settings);
        }

        return resolveThemeSettings(
          this,
          configs.theme,
          configs.editor?.settings,
        );
      },
    );

    if (!settings) {
      throw new Error('Failed to resolve theme settings');
    }

    const { locale, currency } = this.swell.getStorefrontLocalization();

    const request: SwellPageRequest = {
      host: this.swell.url.host,
      origin: this.swell.url.origin,
      path: this.swell.url.pathname,
      query: this.swell.queryParams,
      locale: locale || store.locale,
      currency: currency || store.currency,
      is_editor: this.swell.isEditor,
      is_preview: this.swell.isPreview,
    };

    const swellPage = this.props.pages?.find(
      (page: ThemeSettings) => page.id === pageId,
    );

    const page = {
      ...swellPage,
      current: Number(this.swell.queryParams.page) || 1,
      url: this.swell.url.pathname,
      custom: !swellPage,
      title: swellPage?.label,
      slug: undefined,
      description: undefined,
      $locale: undefined,
    } as ThemePage;

    if (pageId) {
      // Use sync helper internally for better performance
      const templateConfig = this._getTemplateConfigByType(
        'templates',
        pageId,
        altTemplate,
      );

      // TODO: add global.template

      let pageSchema: ThemePageSchema | undefined;
      try {
        pageSchema = JSON5.parse<ThemePageSchema>(
          templateConfig?.file_data || '{}',
        );
      } catch (err) {
        // noop
        logger.warn(err);
      }

      if (pageSchema?.page) {
        const {
          title,
          label, // 'label' is deprecated, kept for compatibility
          description,
          slug,
          $locale,
        } = pageSchema.page;

        page.label = page.label || title || label || ''; // `page.label` is used only for displaying the page name
        page.title = title || page.label; // `page.title` is used exclusively for SEO purposes
        page.slug = slug;
        page.description = description;
        page.$locale = $locale;
      }
    }

    const [cart, account] = await Promise.all([
      this.fetchSingletonResourceCached<StorefrontResource>(
        'cart',
        // The cached cart may be null, but we need the StorefrontResource
        () => this.fetchCart(),
        // Default value (always StorefrontResource)
        () => this.fetchCart(),
      ),

      this.fetchAccount(),
    ]);

    if (!cart) {
      throw new Error('Failed to fetch cart');
    }

    // TODO: move this to compatibility class
    let customer;
    if (this.shopifyCompatibility) {
      customer = account;
    }

    return {
      settings,
      request,
      page,
      cart: cart as SwellStorefrontSingleton,
      account: account as SwellStorefrontSingleton,
      customer: customer as SwellStorefrontSingleton, // Shopify only
    };
  }

  async fetchSingletonResourceCached<R>(
    key: string,
    handler: () => Promise<R>,
    defaultValue: () => R | Promise<R>,
    isCacheble = true,
  ): Promise<R | undefined> {
    // Cookie should change when cart/account is updated
    const cacheKey = this.swell.storefront.session.getCookie();

    if (!cacheKey) {
      return defaultValue();
    }

    const result = await this.swell.getCachedResource(
      `${key}-${cacheKey}`,
      [],
      handler,
      isCacheble,
    );

    return result ?? defaultValue();
  }

  async fetchCart(): Promise<StorefrontResource> {
    const CartResource = this.resources?.singletons?.cart;
    const cart = CartResource
      ? new CartResource(this.swell)
      : new SwellStorefrontSingleton(this.swell, 'cart');

    // Use empty function to enable cart comparison with empty drop in liquid
    cart._isEmpty = function () {
      return !this._result?.items?.length;
    };

    await cart.id;

    if (this.shopifyCompatibility) {
      const compatProps = ShopifyCart(this.shopifyCompatibility, cart);
      cart.setCompatibilityProps(compatProps);
    }

    return cart;
  }

  async fetchAccount(): Promise<StorefrontResource | null> {
    const AccountResource = this.resources?.singletons?.account;
    const account = AccountResource
      ? new AccountResource(this.swell)
      : new SwellStorefrontSingleton(this.swell, 'account');

    await account.id;

    if (!account?.id) {
      return null;
    }

    if (this.shopifyCompatibility) {
      const compatProps = ShopifyCustomer(this.shopifyCompatibility, account);
      account.setCompatibilityProps(compatProps);
    }

    return account;
  }

  getFormConfig(formType: string): ThemeFormConfig | undefined {
    let formId = formType;

    if (this.shopifyCompatibility) {
      const shopifyType =
        this.shopifyCompatibility.getAdaptedFormType(formType);
      if (shopifyType) {
        formId = shopifyType;
      }
    }

    return this.forms?.find((form) => form.id === formId);
  }

  setFormData(
    formId: string,
    options: {
      params?: any;
      success?: boolean;
      withoutErrors?: boolean;
      errors?: ThemeFormErrorMessages;
    },
  ): void {
    const form = this.formData[formId] || new ThemeForm(formId);

    if (form instanceof ThemeForm) {
      if (options?.params) {
        form.setParams(options.params);
      }
      if (options?.errors) {
        form.setSuccess(false);
        form.setErrors(options.errors);
      } else if (options?.success) {
        if (options.withoutErrors && !form.errors) {
          form.setSuccess(true);
        } else if (!options.withoutErrors) {
          form.setSuccess(true);
          form.clearErrors();
        }
      }

      if (this.shopifyCompatibility) {
        Object.assign(form, this.shopifyCompatibility.getFormData(form));
      }
    }

    this.formData[formId] = form;

    this.setGlobals({ forms: this.formData });
  }

  setFormSuccessWithoutErrors(formId: string) {
    this.setFormData(formId, { success: true, withoutErrors: true });
  }

  clearFormData(formId?: string): void {
    if (!formId) {
      this.formData = {};
    } else {
      delete this.formData[formId];
    }

    this.setGlobals({ forms: this.formData });
  }

  serializeFormData(): SwellData | null {
    const serializedFormData: SwellData = {};

    for (const formId in this.formData) {
      const form = this.formData[formId];
      serializedFormData[formId] = {
        success: form.success,
        errors: form.errors && Array.from(form.errors),
      };
    }

    return Object.keys(serializedFormData).length > 0
      ? serializedFormData
      : null;
  }

  setGlobalData(data: SwellData = {}) {
    this.globalData = {
      ...this.globalData,
      ...data,
    };

    this.setGlobals(this.globalData);
  }

  serializeGlobalData(): SwellData | null {
    return Object.keys(this.globalData).length > 0 ? this.globalData : null;
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
   *   field1: 'old1',
   *   field2: 'old2',
   *   field3: 'old3',
   *   field4: 'old4',
   * }
   * ```
   *
   * @output
   * ```js
   * return {
   *   field1: 'value1',
   *   field2: 'value2',
   *   field3: 'old3',
   *   field4: 'old4',
   * }
   * ```
   */
  updateSettings(
    form: Record<string, { value: unknown } | undefined>,
    config: Record<string, unknown>,
  ): ThemeSettings {
    if (this.shopifyCompatibility) {
      return this.shopifyCompatibility.adaptSettings(
        form,
        config as unknown as ShopifySettingsData,
      );
    }

    return extractSettingsFromForm(form, config);
  }

  resolveTranslationLocale(languageConfig: ThemeSettings, locale?: string) {
    if (!languageConfig) {
      return {};
    }

    locale = locale || this.swell.getStorefrontLocalization().locale;

    if (!locale) {
      return languageConfig;
    }

    const localeShortCode = locale.split('-')[0];

    return reduce(
      languageConfig,
      (acc, value, key) => {
        if (isObject(value)) {
          if (key === '$locale') {
            // Assign locale values to the main object
            for (const localeKey of Object.keys(value)) {
              const localeValues = value[localeKey];
              if (isObject(localeValues)) {
                Object.assign(
                  acc,
                  this.resolveTranslationLocale(localeValues, locale),
                );
              }
            }
          } else if (key[0] !== '$') {
            // Continue recursion
            acc[key] = this.resolveTranslationLocale(value, locale);
          }
        } else if (typeof value === 'string') {
          if (value.startsWith('t:')) {
            // Translate from global config
            const translationKey = value.slice(2);
            const translationParts = translationKey.split('.');
            const translationEnd = translationParts.pop();
            const translationPath = translationParts.join('.');
            const translationConfigGlobal = this.globals.language;

            acc[key] =
              get(
                translationConfigGlobal,
                `${translationPath}.$locale.${locale}.${translationEnd}`,
              ) ||
              get(
                translationConfigGlobal,
                `${translationPath}.$locale.${localeShortCode}.${translationEnd}`,
              ) ||
              get(translationConfigGlobal, translationKey) ||
              value;
          } else {
            // Translate from local config
            acc[key] =
              get(languageConfig, `$locale.${locale}.${key}`) ||
              get(languageConfig, `$locale.${localeShortCode}.${key}`) ||
              value;
          }
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  async setCompatibilityConfigs(configs: ThemeConfigs) {
    const shopifyCompatibility = () => {
      if (!this.shopifyCompatibility) {
        this.shopifyCompatibility = new this.shopifyCompatibilityClass(this);
      }
      return this.shopifyCompatibility;
    };

    if (Object.keys(configs.editor).length <= 0 && configs.settings_schema) {
      // The editor should use the store locale, not the storefront locale.
      const store = await this.swell.storefront.settings.get('store');

      configs.editor = shopifyCompatibility().getEditorConfig(
        configs.settings_schema,
      );
      configs.editor = await shopifyCompatibility().renderSchemaTranslations(
        this,
        configs.editor,
        (store.locale as string) || 'en-US',
      );
    }

    if (Object.keys(configs.theme).length <= 0 && configs.settings_data) {
      configs.theme = shopifyCompatibility().getThemeConfig(
        configs.settings_data,
      );
      this.themeSettingFilePath = 'theme/config/settings_data.json';
    }

    if (Object.keys(configs.presets).length <= 0 && configs.settings_data) {
      configs.presets = shopifyCompatibility().getPresetsConfig(
        configs.settings_data,
      );
    }

    // Make sure compatibility instance and config setting are resolved
    if (configs.theme.shopify_compatibility) {
      shopifyCompatibility();
    } else if (this.shopifyCompatibility) {
      configs.theme.shopify_compatibility = true;
    }
  }

  setCompatibilityData(pageData: SwellData) {
    if (!pageData || !this.shopifyCompatibility) {
      return;
    }
    this.shopifyCompatibility.adaptPageData(pageData);
  }

  async getLocaleConfig(
    localeCode = 'en',
    suffix = '.json',
  ): Promise<ThemeLocaleConfig> {
    const allLocaleConfigs = this.getThemeConfigsByPath(
      'theme/locales/',
      suffix,
    );

    let localeConfig: SwellThemeConfig | null =
      allLocaleConfigs.get(`theme/locales/${localeCode}${suffix}`) ?? null;

    if (!localeConfig) {
      // Fall back to short code locale
      const localeShortCode = localeCode.split('-')[0];

      localeConfig =
        allLocaleConfigs.get(`theme/locales/${localeShortCode}${suffix}`) ??
        null;

      if (!localeConfig) {
        // Fall back to default locale
        const defaultLocale = `.default${suffix}`;

        for (const config of allLocaleConfigs.values()) {
          if (config.file_path?.endsWith(defaultLocale)) {
            localeConfig = config;
            break;
          }
        }
      }
    }

    if (localeConfig) {
      localeConfig = await this.getThemeConfig(localeConfig.file_path);

      try {
        return JSON5.parse<ThemeLocaleConfig>(localeConfig?.file_data || '{}');
      } catch (err) {
        // noop
        logger.warn(err);
      }
    }

    return {};
  }

  resolveLookupSetting(
    setting: ThemeSettingFieldSchema,
    value: unknown,
  ): SwellData | SwellStorefrontRecord | SwellStorefrontCollection | null {
    if (value instanceof StorefrontResource) {
      return value;
    }

    const collection = resolveLookupCollection(setting);

    if (collection) {
      if (setting.multiple) {
        if (Array.isArray(value)) {
          return value.map((id: string) =>
            this.resolveLookupResource(collection, id),
          );
        }
      } else if (value !== '' && value !== null && value !== undefined) {
        return this.resolveLookupResource(collection, value as string);
      }
    }

    return null;
  }

  resolveLookupResource(
    collection: string,
    id: string,
  ): StorefrontResource<SwellRecord> {
    const LookupResource = this.resources?.records?.[collection];
    const resource = LookupResource
      ? new LookupResource(this.swell, id)
      : new SwellStorefrontRecord(this.swell, collection, id);

    if (this.shopifyCompatibility) {
      this.shopifyCompatibility.adaptPageData({ resource });
    }

    return resource;
  }

  resolveMenuSettings(): Promise<Record<string, SwellMenu | undefined>> {
    return resolveMenuSettings(this, this.swell.getStorefrontMenus(), {
      currentUrl: this.swell.url.pathname,
    });
  }

  resolveMenuSetting(value: string): SwellMenu | null {
    if (!value) {
      return null;
    }

    const allMenus = this.globals.menus || {};
    const menu = allMenus[value] || allMenus[value.replace(/-/g, '_')];

    return menu || null;
  }

  async lang(key: string, data?: any, fallback?: string): Promise<string> {
    return await this.renderTranslation(key, data, fallback);
  }

  resolveFontSetting(value: string): ThemeFont {
    if (this.shopifyCompatibility) {
      const fontSetting =
        this.shopifyCompatibility.getFontFromShopifySetting(value);

      const adaptedFont = ThemeFont.get(fontSetting || value);
      Object.assign(
        adaptedFont,
        this.shopifyCompatibility.getFontData(adaptedFont),
      );

      return adaptedFont;
    }

    return ThemeFont.get(value);
  }

  resolveUrlSetting(value: string): string {
    let resolvedUrl = value;

    if (this.shopifyCompatibility) {
      // Remove shopify:// protocol
      if (value?.startsWith('shopify://')) {
        resolvedUrl = value.replace('shopify://', '/');
      }

      const adaptedUrl =
        this.shopifyCompatibility.getAdaptedPageUrl(resolvedUrl);

      if (adaptedUrl) {
        return adaptedUrl;
      }
    }

    return resolvedUrl;
  }

  resolveImageSetting(value: string): string {
    let resolvedUrl = value;

    if (this.shopifyCompatibility) {
      // Remove shopify images
      if (value?.startsWith('shopify://')) {
        resolvedUrl = '';
      }
    }

    return resolvedUrl;
  }

  async preloadThemeConfigs(
    payload: SwellThemePreload,
  ): Promise<PutFilesResult> {
    const result = await this.themeLoader.updateThemeCache(payload);

    // Log warnings at the theme level for visibility
    if (result.warnings && result.warnings.length > 0) {
      const rejected = result.warnings.filter(
        (w) => w.reason === 'rejected_5mb' || w.reason === 'exceeded_25mb',
      ).length;
      const warned = result.warnings.filter(
        (w) => w.reason === 'warning_1mb',
      ).length;

      logger.warn('[Theme] File size issues detected during cache update', {
        totalWarnings: result.warnings.length,
        rejected,
        warned,
        details: result.warnings.slice(0, 5), // Log first 5 warnings for debugging
      });
    }

    return result;
  }

  getPageConfigPath(pageId: string, altTemplate?: string): string | null {
    if (this.shopifyCompatibility) {
      const configPath = this.shopifyCompatibility.getThemeFilePath(
        'templates',
        pageId,
      );

      return `${withSuffix(`theme/${configPath}`, altTemplate)}.json`;
    }

    return `${withSuffix(`theme/templates/${pageId}`, altTemplate)}.json`;
  }

  async getThemeConfig(filePath: string): Promise<SwellThemeConfig | null> {
    // All configs are pre-loaded in themeLoader after init
    // Wrapped in Promise for backward compatibility with LiquidSwell
    return this.themeLoader.getConfig(filePath);
  }

  getThemeConfigsByPath(
    pathPrefix: string,
    pathSuffix?: string,
  ): Map<string, SwellThemeConfig> {
    // Get configs directly from pre-loaded data
    const configs = this.themeLoader.getConfigsByPath(pathPrefix, pathSuffix);

    const configsByPath = new Map<string, SwellThemeConfig>();
    for (const config of configs) {
      configsByPath.set(config.file_path, config);
    }

    return configsByPath;
  }

  async getThemeTemplateConfig(
    filePath: string,
  ): Promise<SwellThemeConfig | null> {
    // Use internal sync helper and wrap result in Promise
    return this._getTemplateConfig(filePath);
  }

  /**
   * Internal synchronous helper for getting template configs by type.
   * Used internally within theme.ts to avoid async overhead.
   */
  private _getTemplateConfigByType(
    type: string,
    name: string,
    suffix?: string,
  ): SwellThemeConfig | null {
    const templatesByPriority = [withSuffix(`${type}/${name}`, suffix)];

    if (this.shopifyCompatibility) {
      const path = this.shopifyCompatibility.getThemeFilePath(type, name);
      templatesByPriority.push(withSuffix(path, suffix));
    }

    for (const filePath of templatesByPriority) {
      // Use sync helper internally
      const templateConfig = this._getTemplateConfig(`theme/${filePath}`);
      if (templateConfig) {
        return templateConfig;
      }
    }

    return null;
  }

  /**
   * Internal synchronous helper for getting template configs.
   */
  private _getTemplateConfig(filePath: string): SwellThemeConfig | null {
    // Explicit extension
    if (filePath.endsWith('.json') || filePath.endsWith('.liquid')) {
      return this.themeLoader.getConfig(filePath);
    }

    // Try to find a JSON template first
    const jsonTemplate = this.themeLoader.getConfig(`${filePath}.json`);

    if (jsonTemplate) {
      return jsonTemplate;
    }

    return this.themeLoader.getConfig(`${filePath}.liquid`);
  }

  async getThemeTemplateConfigByType(
    type: string,
    name: string,
    suffix?: string,
  ): Promise<SwellThemeConfig | null> {
    // Use internal sync helper
    return this._getTemplateConfigByType(type, name, suffix);
  }

  async getAssetConfig(assetName: string): Promise<SwellThemeConfig | null> {
    // Asset support both inside and outside theme folder
    return (
      (await this.getThemeConfig(`theme/assets/${assetName}`)) ??
      (await this.getThemeConfig(`assets/${assetName}`)) ??
      null
    );
  }

  async getAssetUrl(filePath: string): Promise<string | null> {
    const assetConfig = await this.getAssetConfig(filePath);

    const file = assetConfig?.file;

    if (!file) {
      return null;
    }

    const fileUrl: string | null = file.url || null;

    if (!fileUrl) {
      return fileUrl;
    }

    return fileUrl.endsWith(filePath) ? fileUrl : `${fileUrl}/${filePath}`;
  }

  async renderTemplate(
    config: SwellThemeConfig | null,
    data?: SwellData,
  ): Promise<string> {
    let template = config?.file_data || null;

    if (config === null || template === null) {
      return '';
    }

    template = unescapeLiquidSyntax(template);
    try {
      const result = await this.liquidSwell.parseAndRender(template, data);
      return result;
    } catch (err: any) {
      logger.error(err);
      return `<!-- template render error: ${err.message} -->`;
    }
  }

  async renderTemplateString(
    templateString: string,
    data?: SwellData,
  ): Promise<string> {
    try {
      return await this.liquidSwell.parseAndRender(templateString, data);
    } catch (err) {
      logger.error(err);
      return '';
    }
  }

  async getSectionSchema(
    sectionName: string,
  ): Promise<Partial<ThemeSectionSchema> | undefined> {
    let result: Partial<ThemeSectionSchema> | undefined;

    // Use sync helper internally
    const config = this._getTemplateConfigByType('sections', sectionName);

    if (config?.file_path?.endsWith('.json')) {
      try {
        result =
          JSON5.parse<Partial<ThemeSectionSchema>>(config.file_data) ||
          undefined;

        if (this.shopifyCompatibility) {
          result = this.shopifyCompatibility.getSectionConfigSchema(
            result as ShopifySectionSchema,
          );

          result = await this.shopifyCompatibility.renderSchemaTranslations(
            this,
            result,
            this.globals.store?.locale as string,
          );
        }
      } catch (err) {
        // noop
        logger.warn(err);
        return undefined;
      }
    } else if (config?.file_path?.endsWith('.liquid')) {
      // Fallback to the liquid file schema
      if (this.shopifyCompatibility) {
        this.liquidSwell.lastSchema = undefined;

        const configWithSchema = this.getSectionConfigWithSchemaTagOnly(config);
        if (!configWithSchema) {
          return;
        }

        await this.renderTemplate(configWithSchema);

        const schema = this.liquidSwell.lastSchema;
        if (schema) {
          result = this.shopifyCompatibility.getSectionConfigSchema(schema);

          result = await this.shopifyCompatibility.renderSchemaTranslations(
            this,
            result,
            this.globals.store?.locale as string,
          );
        }
      }
    }

    // Normalize schema properties
    if (result) {
      result.id = result.id || sectionName;
      result.label = result.label || sectionName;
      result.fields = result.fields || [];
    }

    return result;
  }

  getSectionConfigWithSchemaTagOnly(
    config: SwellThemeConfig,
  ): SwellThemeConfig | null {
    const schemaTag = '{% schema %}';
    const schemaEndTag = '{% endschema %}';
    const schemaStartIndex = config.file_data.indexOf(schemaTag);
    const schemaEndIndex = config.file_data.indexOf(schemaEndTag);
    const schemaData = config.file_data.slice(
      schemaStartIndex + schemaTag.length,
      schemaEndIndex,
    );

    if (schemaStartIndex === -1 || schemaEndIndex === -1) {
      return null;
    }

    return {
      ...config,
      file_data: schemaTag + schemaData + schemaEndTag,
    };
  }

  async renderThemeTemplate(
    filePath: `${string}.liquid`,
    data?: SwellData,
  ): Promise<string>;

  async renderThemeTemplate(
    filePath: `${string}.json`,
    data?: SwellData,
  ): Promise<ThemePageTemplateConfig>;

  async renderThemeTemplate(
    filePath: string,
    data?: SwellData,
  ): Promise<string | ThemePageTemplateConfig>;

  async renderThemeTemplate(
    filePath: string,
    data?: SwellData,
  ): Promise<string | ThemePageTemplateConfig> {
    const config = await this.getThemeTemplateConfig(filePath);

    const content = await this.renderTemplate(config, data);

    if (config?.file_path?.endsWith('.json')) {
      try {
        return JSON5.parse<ThemePageTemplateConfig>(content);
      } catch (err) {
        logger.error('[SDK] Unable to render theme template', {
          file: config.file_path,
          content,
        });
        throw new PageError(err as Error);
      }
    }

    return content;
  }

  async renderLayoutTemplate(name: string, data?: SwellData): Promise<string> {
    // Use sync helper internally
    const templateConfig = this._getTemplateConfigByType('layouts', name);

    if (!templateConfig) {
      throw new Error(`Layout template not found: ${name}`);
    }

    let content = await this.renderThemeTemplate(
      templateConfig.file_path,
      data,
    );

    if (typeof content !== 'string') {
      return `<!-- invalid layout: ${name}--> {{ content_for_layout }}`;
    }

    // Inject custom css
    if (!this.globals.request.is_editor) {
      let customCss = (this.globals.settings.custom_css || '') as
        | string
        | string[];

      if (Array.isArray(customCss)) {
        customCss = customCss.join('\n').trim();
      }

      if (customCss) {
        let pos = -1;
        let match = null;
        const regex = /<\/body\s*?>/gi;

        // Get last occurrence of </body> tag in the content
        while ((match = regex.exec(content)) !== null) {
          pos = match.index;
        }

        if (pos !== -1) {
          content = `${content.slice(0, pos)}
<style>${customCss}</style>
${content.slice(pos)}`;
        }
      }
    }

    return content;
  }

  async renderPageTemplate(
    name: string,
    data?: SwellData,
    altTemplateId?: string,
  ): Promise<string | ThemePageTemplateConfig> {
    let templateConfig: SwellThemeConfig | null = null;

    if (altTemplateId) {
      // Use sync helper internally
      templateConfig = this._getTemplateConfigByType(
        'templates',
        name,
        altTemplateId,
      );
    }

    if (!templateConfig) {
      // Use sync helper internally
      templateConfig = this._getTemplateConfigByType('templates', name);
    }

    if (templateConfig) {
      const templatePath = name.split('/').splice(1).join('/') || null;

      let templateData = {
        name,
        alt_name: altTemplateId || null,
        path: templatePath || null,
      } as SwellData;

      if (this.shopifyCompatibility) {
        templateData = ShopifyTemplate(this.shopifyCompatibility, templateData);
      }

      this.setGlobals({ template: templateData });

      const themeTemplate = await this.renderThemeTemplate(
        templateConfig.file_path,
        data,
      );

      if (themeTemplate && typeof themeTemplate !== 'string') {
        themeTemplate.id = String(templateConfig.name);
      }

      return themeTemplate;
    }

    throw new PageNotFound('Page template not found', 404, `templates/${name}`);
  }

  async renderPage(
    pageData?: SwellData,
    altTemplateId?: string,
  ): Promise<string | ThemePageTemplateConfig> {
    // Set page data as globals
    if (pageData) {
      this.setGlobals(pageData);
    }

    let pageConfig;

    if (this.pageId) {
      pageConfig = await this.renderPageTemplate(
        this.pageId,
        pageData,
        altTemplateId,
      );
    } else {
      pageConfig = await this.renderPageTemplate('404', pageData);
    }

    if (typeof pageConfig !== 'string' && pageConfig?.page) {
      if (pageConfig.page.published === false) {
        throw new PageNotFound();
      }

      pageConfig.page = this.resolveTranslationLocale(
        pageConfig.page as ThemeSettings,
      );
    }

    return pageConfig;
  }

  getShopify1HomePageSectionGroup(): ThemeSectionGroup {
    // Special case: Shopify 1.0 index page has section data in global theme settings
    const themeSettings = this.globals.configs.theme || {};

    return {
      sections: themeSettings.sections || {},
      // Section order is handled by `content_for_index`
      // If undefined or empty we'll use natural attribute order
      order: themeSettings.content_for_index || [],
    };
  }

  async getShopify1HomePageSections(
    resolveSettings: boolean = true,
  ): Promise<ThemeSectionConfig[]> {
    const sectionGroup = this.getShopify1HomePageSectionGroup();
    return this.getPageSections(sectionGroup, resolveSettings);
  }

  async renderShopify1HomePage(pageContent: string): Promise<string> {
    const sectionGroup = this.getShopify1HomePageSectionGroup();
    const contentForIndex = await this.renderPageSections(sectionGroup);
    return this.renderTemplateString(pageContent, {
      content_for_index: contentForIndex,
    });
  }

  isShopify1HomePage(
    pageId: string,
    pageContent: unknown,
  ): pageContent is string {
    return Boolean(pageId === 'index' && typeof pageContent === 'string');
  }

  async renderAllSections(
    sectionsIds: string | Array<string>,
    pageData?: SwellData,
  ): Promise<Record<string, string | undefined>> {
    const sections =
      typeof sectionsIds === 'string'
        ? sectionsIds.split(/\s*,\s*/)
        : sectionsIds;

    const sectionsRendered = await Promise.all(
      sections.map((sectionId) => {
        return this.renderSection(sectionId, pageData);
      }),
    );

    return sectionsRendered.reduce(
      (acc, section, index) => {
        const sectionId = sections[index];
        if (this.shopifyCompatibility) {
          // TODO: figure out a way to use compatibility class for this
          acc[sectionId] = `
          <div id="shopify-section-${sectionId}" class="shopify-section">${String(section)}</div>
        `.trim();
        } else {
          acc[sectionId] = `
          <div id="swell-section-${sectionId}" class="swell-section">${String(section)}</div>
        `.trim();
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  async renderSection(
    sectionId: string,
    pageData?: SwellData,
  ): Promise<string | ThemePageTemplateConfig> {
    // Set page data as globals
    if (pageData) {
      this.setGlobals(pageData);
    }

    // Section ID could be a section name or a given config ID within a template
    const [sectionKey, originalPageId] = sectionId
      .split(/__/) // Split generated IDs if needed
      .reverse();

    // return replaced '/' back
    const pageId = (originalPageId || '').replaceAll('_', '/');

    // Use sync helper internally
    const templateConfig = this._getTemplateConfigByType(
      pageId ? 'templates' : 'sections',
      pageId ? pageId : sectionKey,
    );

    if (templateConfig) {
      const sectionContent = await this.renderThemeTemplate(
        templateConfig.file_path,
        pageData,
      );

      // Render a section of a page template
      if (pageId && (sectionContent as ThemeSectionGroup)?.sections) {
        const oldSections = (sectionContent as ThemeSectionGroup)?.sections;

        const pageSectionGroup = {
          // use original pageId to return exactly the requested section id
          id: originalPageId,
          sections: {
            [sectionKey]: oldSections[sectionKey],
          },
        };

        const [pageSection] = await this.renderPageSections(
          pageSectionGroup,
          pageData,
        );

        return pageSection.output || '';
      }

      return sectionContent;
    }

    return '';
  }

  async renderLayout(
    layoutName?: string,
    data?: SwellData,
    contentForLayout?: string,
    contentForHeader?: string,
  ): Promise<string> {
    layoutName = layoutName || this.liquidSwell.layoutName;

    if (layoutName) {
      if (data) {
        data = await this.renderDataFields(data, [
          'page_title',
          'page_description',
        ]);
      }

      return this.renderLayoutTemplate(layoutName, {
        ...data,
        content_for_layout: contentForLayout,
        content_for_header: contentForHeader,
      });
    } else {
      // Render content directly when layout is `none`
      return contentForLayout || '';
    }
  }

  private async renderDataFields(
    data: SwellData,
    fields: string[],
  ): Promise<SwellData> {
    const promises: Promise<void>[] = [];

    for (const key of fields) {
      const promise =
        typeof data[key] === 'string'
          ? this.renderTemplateString(data[key], data)
          : Promise.resolve();

      promises.push(
        promise
          .then((value: string | void) => {
            // fallback to globals value that can be string or RenderDrop
            return value ? value : (this.globals[key] as Promise<string>);
          })
          .then((value: string) => {
            data[key] = value;
          }),
      );
    }

    if (promises.length > 0) {
      data = { ...data };
      await Promise.all(promises);
    }

    return data;
  }

  getContentForHeader(): string {
    let content = '\n';

    // Include google font stylesheet for global font settings
    // Note: this means fonts will not be loaded if they are used in section settings
    content += this.renderFontHeaderLinks();

    if (this.shopifyCompatibility) {
      content += `\n${this.shopifyCompatibility.getContentForHeader()}`;
    }

    return content;
  }

  renderFontHeaderLinks(): string {
    const themeSettings = this.globals.settings;
    const editorSettings = this.globals.configs?.editor?.settings || [];

    if (themeSettings && editorSettings) {
      const fontSettings = findThemeSettingsByType(
        'font',
        themeSettings,
        editorSettings,
      );

      const combinedFonts: string[] = [];
      for (let i = 0; i < fontSettings.length; i++) {
        const value = fontSettings[i].value?.id || fontSettings[i].value;
        // Adapt shopify fonts first if applicable
        if (this.shopifyCompatibility) {
          const fontSetting =
            this.shopifyCompatibility.getFontFromShopifySetting(value);
          if (!combinedFonts.includes(fontSetting || value)) {
            combinedFonts.push(fontSetting || value);
          }
        } else if (!combinedFonts.includes(value)) {
          combinedFonts.push(value);
        }
      }

      if (fontSettings.length > 0) {
        const fontUrl = ThemeFont.combinedGoogleFontUrl(combinedFonts);
        return `<link href="${fontUrl}" rel="stylesheet">`;
      }
    }

    return '';
  }

  async getTemplateSchema(
    config: SwellThemeConfig,
  ): Promise<ThemeSectionSchema | undefined> {
    let schema: ThemeSectionSchema | undefined;

    const resolvedConfig = await this.getThemeConfig(config.file_path);

    if (!resolvedConfig) {
      return;
    }

    if (resolvedConfig.file_path.endsWith('.liquid')) {
      if (this.shopifyCompatibility) {
        // Extract {% schema %} from liquid files for Shopify compatibility
        this.liquidSwell.lastSchema = undefined;

        // Get only the schema tag from the template,
        // as other tags may need data for rendering
        const schemaConfig: SwellThemeConfig = {
          ...resolvedConfig,
          file_data: extractSchemaTag(resolvedConfig.file_data),
        };

        await this.renderTemplate(schemaConfig);

        const lastSchema = (this.liquidSwell.lastSchema ||
          {}) as ShopifySectionSchema;

        if (lastSchema) {
          const configSchema =
            this.shopifyCompatibility.getSectionConfigSchema(lastSchema);

          schema =
            await this.shopifyCompatibility.renderSchemaTranslations<ThemeSectionSchema>(
              this,
              configSchema as ThemeSectionSchema,
              this.globals.store?.locale,
            );
        }
      }
    } else if (resolvedConfig.file_data) {
      try {
        schema = JSON5.parse(resolvedConfig?.file_data) || undefined;
      } catch (err) {
        // noop
        logger.warn(err);
      }
    }

    return schema;
  }

  resolveStaticSectionSettings(
    sectionSchema: ThemeSectionSchema,
    presetSchema?: ThemePresetSchema,
  ): SwellData {
    const defaults: SwellData = {};

    const defaultSchema: ThemePresetSchema =
      presetSchema || sectionSchema?.default || ({} as ThemePresetSchema);

    if (sectionSchema?.fields) {
      for (const field of sectionSchema.fields) {
        if (field.id && field.default !== undefined) {
          defaults[field.id] = field.default;
        }
      }
    }

    Object.assign(defaults, defaultSchema.settings, {
      blocks: defaultSchema.blocks,
    });

    if (Array.isArray(defaults.blocks)) {
      defaults.blocks = defaults.blocks.map(
        (block: ThemeSettingsBlock): ThemeSettingsBlock => {
          const blockDefaults: SwellData = {};

          const blockSchema = sectionSchema?.blocks?.find(
            (schema) => schema.type === block.type,
          );

          if (blockSchema?.fields) {
            for (const field of blockSchema.fields) {
              if (field.id && field.default !== undefined) {
                blockDefaults[field.id] = field.default;
              }
            }
          }

          return {
            ...block,
            settings: {
              ...blockDefaults,
              ...(block.settings || undefined),
            },
          };
        },
      );
    }

    return defaults;
  }

  async getAllSections(): Promise<ThemePageSectionSchema[]> {
    // Get configs synchronously from pre-loaded data
    const configs = this.getThemeConfigsByPath('theme/sections/');
    return getAllSections(configs, this.getTemplateSchema.bind(this));
  }

  async getPageSections(
    sectionGroup: ThemeSectionGroup,
    resolveSettings: boolean = true,
  ): Promise<ThemeSectionConfig[]> {
    const sectionConfigs = await getPageSections(sectionGroup, (type) =>
      this.getSectionSchema(type),
    );

    // Resolve page section settings
    if (resolveSettings) {
      for (const sectionConfig of sectionConfigs) {
        const { schema } = sectionConfig;
        if (schema?.fields && this.globals && sectionConfig.settings) {
          sectionConfig.settings = resolveSectionSettings(this, sectionConfig);
        }
      }
    }

    return sectionConfigs;
  }

  async addPageSection(sectionFileName: string, group: boolean): Promise<void> {
    if (this.pageSectionGroups === null) {
      return;
    }

    const { pageSectionGroups } = this;
    const sectionSchema = await this.getSectionSchema(sectionFileName);
    const sectionName = sectionSchema?.label || sectionFileName;

    let sourcePath = '';

    if (group) {
      // Use sync helper internally
      const sectionConfig = this._getTemplateConfigByType(
        'sections',
        `${sectionFileName}.json`,
      );

      sourcePath = sectionConfig?.file_path ?? '';
    }

    pageSectionGroups.push({
      prop: getSectionGroupProp(sectionFileName),
      label: sectionName,
      source: sourcePath,
      group,
    });
  }

  /**
   * Get a list of sections and section groups in a page layout.
   */
  async getPageSectionGroups(
    pageId: string,
    altTemplate?: string,
  ): Promise<ThemeSectionGroupInfo[]> {
    // Use sync helper internally
    const pageConfig = this._getTemplateConfigByType(
      'templates',
      pageId,
      altTemplate,
    );

    if (pageConfig === null) {
      return [];
    }

    const pageSchema = parseJsonConfig<ThemePageSchema>(pageConfig);
    const pageLayout = pageSchema.layout || '';

    const pageSectionGroups: ThemeSectionGroupInfo[] = [];
    this.pageSectionGroups = pageSectionGroups;

    await this.renderLayout(
      pageLayout,
      {},
      new RenderDrop(() => {
        pageSectionGroups.push({
          prop: SECTION_GROUP_CONTENT,
          label: 'Template',
          source: pageConfig.file_path,
          group: true,
        });

        return '';
      }) as unknown as string,
    );

    this.pageSectionGroups = null;

    return pageSectionGroups;
  }

  async getLayoutSectionGroups(
    sectionGroups: ThemeSectionGroupInfo[],
    resolveSettings: boolean = true,
  ): Promise<ThemeLayoutSectionGroupConfig[]> {
    const configs = new Map<string, SwellThemeConfig>();

    for (const sectionGroup of sectionGroups) {
      const config = await this.getThemeConfig(sectionGroup.source);

      if (config) {
        configs.set(config.file_path, config);
      }
    }

    // TODO: de-dupe with getAllSections
    const layoutSectionGroups = await getLayoutSectionGroups(
      configs,
      this.getTemplateSchema.bind(this),
    );

    // Resolve section config settings
    if (resolveSettings) {
      for (const layoutSectionGroup of layoutSectionGroups) {
        for (const sectionConfig of layoutSectionGroup.sectionConfigs) {
          const { schema } = sectionConfig;
          if (schema?.fields && this.globals && sectionConfig.settings) {
            sectionConfig.settings = resolveSectionSettings(
              this,
              sectionConfig,
            );
          }
        }
      }
    }

    return layoutSectionGroups;
  }

  async renderPageSections(
    sectionGroup: ThemeSectionGroup,
    data?: SwellData,
  ): Promise<ThemeSectionConfig[]> {
    let sectionConfigs = await this.getPageSections(sectionGroup, true);
    // skip disabled sections
    sectionConfigs = sectionConfigs.filter(
      (sectionConfig) => sectionConfig.section.disabled !== true,
    );
    return this.renderSectionConfigs(sectionConfigs, data);
  }

  async renderSectionConfigs(
    sectionConfigs: ThemeSectionConfig[],
    data?: SwellData,
  ): Promise<ThemeSectionConfig[]> {
    return Promise.all(
      sectionConfigs.map(async (sectionConfig, index) => {
        const { section, schema } = sectionConfig;
        const settings =
          schema?.fields && this.globals
            ? resolveSectionSettings(this, sectionConfig, index)
            : { ...sectionConfig.settings };

        // Use sync helper internally
        const templateConfig = this._getTemplateConfigByType(
          'sections',
          `${section.type}.liquid`,
        );
        let output = '';
        if (templateConfig) {
          output = await this.renderTemplate(templateConfig, {
            ...data,
            ...settings,
            index,
          });

          if (settings?.section?.custom_css) {
            output += `<style>${scopeCustomCSS(
              settings.section.custom_css,
              sectionConfig.id,
            )}</style>`;
          }
        }

        return {
          ...sectionConfig,
          output,
        };
      }),
    );
  }

  async renderTranslation(
    key: string,
    data?: unknown,
    fallback?: string,
  ): Promise<string> {
    const langObject = this.globals.language;
    const localeCode = this.globals.request?.locale;

    return this.renderTranslationValue(
      localeCode,
      langObject,
      key,
      data,
      fallback,
    );
  }

  async renderTranslationValue(
    localeCode: string,
    langConfig: any,
    key: string,
    data?: any,
    fallback?: string,
  ): Promise<string> {
    if (key === undefined) {
      return fallback || '';
    }

    const keyParts = key?.split('.') || [];
    const keyName = keyParts.pop() || '';
    const keyPath = keyParts.join('.');
    const langObject = get(langConfig, keyPath);

    let localeValue =
      get(langObject?.[localeCode], keyName) ||
      get(langObject?.[localeCode.split('-')[0]], keyName) ||
      langObject?.[keyName];

    // Plural vs singular
    if (data?.count !== undefined && localeValue?.one) {
      localeValue = data.count === 1 ? localeValue.one : localeValue.other;
    }

    if (typeof localeValue !== 'string' || localeValue === '') {
      return fallback || '';
    }

    const result = await this.renderTemplateString(localeValue, data);

    return result || fallback || '';
  }

  renderCurrency(amount: number, params?: FormatInput): string {
    return this.swell.storefront.currency.format(amount, params as FormatInput);
  }
}

export class PageError extends Error {
  public title: string;
  public status: number = 500;
  public description?: string;

  constructor(
    title: string | Error = 'Something went wrong',
    status: number = 500,
    description?: string,
  ) {
    title = String(title);
    super(title + (description ? `: ${description}` : ''));
    this.title = title;
    this.status = status;
    this.description = description;
  }

  toString(): string {
    return this.message;
  }
}

export class PageNotFound extends PageError {
  constructor(
    title: string = 'Page not found',
    status: number = 404,
    description?: string,
  ) {
    super(title, status, description);
  }
}

export function resolveSectionSettings(
  theme: SwellTheme,
  sectionConfig: ThemeSectionConfig,
  index?: number,
): ThemeSectionSettings | undefined {
  const { settings, schema } = sectionConfig;

  if (!schema || !settings?.section?.settings) {
    return settings;
  }

  const editorSettings: ThemeSettingSectionSchema[] = [
    {
      label: schema.label,
      fields: schema.fields,
    },
  ];

  // skip disabled blocks
  let blocks = settings.section.blocks?.filter(
    (block) => block.disabled !== true,
  );

  blocks = blocks?.map((block) => ({
    ...block,
    settings: resolveThemeSettings(
      theme,
      block.settings,
      schema.blocks?.filter((schemaBlock) => schemaBlock.type === block.type),
    ),
  }));

  return {
    ...settings,
    section: {
      ...settings.section,
      settings: resolveThemeSettings(
        theme,
        settings.section.settings,
        editorSettings,
      ),
      blocks,
      index0: index,
      index: typeof index === 'number' ? index + 1 : undefined,
      location: getSectionLocation(settings.section.type),
    },
  };
}

function fillDefaultThemeSettings(
  themeSettings: ThemeSettings,
  editorSchemaSettings: ThemeSettingSectionSchema[],
): void {
  for (const section of editorSchemaSettings) {
    for (const field of section.fields) {
      if (field.id && !Object.hasOwn(themeSettings, field.id)) {
        themeSettings[field.id] =
          typeof field.default !== 'undefined' ? field.default : '';
      }
    }
  }
}

export function resolveThemeSettings(
  theme: SwellTheme,
  themeSettings: ThemeSettings,
  editorSchemaSettings?: ThemeSettingSectionSchema[],
): ThemeSettings {
  const settings = cloneDeep(themeSettings);

  if (settings.$locale) {
    const { locale } = theme.swell.getStorefrontLocalization();
    const localeConfig = settings.$locale[locale] || {};

    for (const [key, value] of Object.entries(localeConfig)) {
      if (value) {
        settings[key] = value;
      }
    }
  }

  each(settings, (value, key) => {
    const setting =
      (editorSchemaSettings && findEditorSetting(editorSchemaSettings, key)) ??
      null;

    if (isObject(value) && !(value instanceof StorefrontResource)) {
      // Object-based setting types
      switch (setting?.type) {
        case 'color_scheme_group': {
          each(value, (scheme, schemeId) => {
            if (
              isObject(scheme) &&
              typeof scheme.settings === 'object' &&
              scheme.settings
            ) {
              const settings = scheme.settings as Record<
                string,
                string | ThemeColor
              >;

              each(settings, (colorValue, colorId) => {
                const fieldDef = find(setting.fields, { id: colorId });

                // Skip empty values and gradient field
                if (fieldDef?.type === 'color' && colorValue) {
                  scheme.id = schemeId;
                  settings[colorId] = new ThemeColor(colorValue);
                }
              });
            }
          });

          return;
        }

        case 'color':
          settings[key] = ThemeColor.get(value as any);
          return;

        default:
          break;
      }
      // Nested settings
      settings[key] = resolveThemeSettings(theme, value, editorSchemaSettings);
    } else {
      switch (setting?.type) {
        case 'lookup':
        case 'product_lookup':
        case 'category_lookup':
        case 'customer_lookup':
          settings[key] = theme.resolveLookupSetting(setting, value);
          break;
        case 'color':
          if (value) {
            settings[key] = new ThemeColor(value);
          }
          break;
        case 'font':
          settings[key] = theme.resolveFontSetting(value);
          break;
        case 'menu':
          settings[key] = theme.resolveMenuSetting(value);
          break;
        case 'url':
          settings[key] = theme.resolveUrlSetting(value);
          break;
        case 'image':
          settings[key] = theme.resolveImageSetting(value);
          break;
        default:
          break;
      }
    }
  });

  return settings;
}

export interface ThemeSettingFieldValue {
  setting: ThemeSettingFieldSchema;
  value: any;
}

export function findThemeSettingsByType(
  type: string,
  themeSettings: ThemeSettings,
  editorSchemaSettings: ThemeSettingSectionSchema[],
): ThemeSettingFieldValue[] {
  const foundSettings: ThemeSettingFieldValue[] = [];

  each(themeSettings, (value, key) => {
    // Ignore ThemeFont and StorefrontResource
    if (
      isObject(value) &&
      !(value instanceof ThemeFont) &&
      !(value instanceof StorefrontResource)
    ) {
      // Nested settings
      foundSettings.push(
        ...findThemeSettingsByType(type, value, editorSchemaSettings),
      );
    } else {
      const setting = findEditorSetting(editorSchemaSettings, key);
      if (setting?.type === type) {
        foundSettings.push({ setting, value });
      }
    }
  });

  return foundSettings;
}

export function resolveLookupCollection(
  setting: ThemeSettingFieldSchema,
): string | null | undefined {
  if (setting.collection) {
    return setting.collection;
  }
  switch (setting.type) {
    case 'product_lookup':
      return 'products';
    case 'category_lookup':
      return 'categories';
    case 'customer_lookup':
      return 'accounts';
    default:
      break;
  }
}

export function findEditorSetting(
  editorSchemaSettings: ThemeSettingSectionSchema[],
  key: string,
): ThemeSettingFieldSchema | null {
  for (const section of editorSchemaSettings || []) {
    for (const field of section.fields) {
      if (field.id === key) {
        return field;
      }
    }
  }

  return null;
}

function parseJsonConfig<T>(config?: SwellThemeConfig | null): T {
  try {
    return JSON5.parse<T>(config?.file_data || '{}');
  } catch (err) {
    logger.warn(err);
    return {} as T;
  }
}

function replacerUnescape(match: string): string {
  return match.includes('\\"') ? (JSON.parse(`"${match}"`) as string) : match;
}

function unescapeLiquidSyntax(template: string): string {
  return template.replace(/\{\{.*?\}\}/g, replacerUnescape);
}

function extractSchemaTag(template: string): string {
  const list = template.match(
    /\{%-?\s*schema\s*-?%\}(.*)\{%-?\s*endschema\s*-?%\}/s,
  );

  if (list === null) {
    return template;
  }

  return list[0];
}

function withSuffix(path: string, suffix?: string) {
  return suffix ? `${path}.${suffix}` : path;
}
