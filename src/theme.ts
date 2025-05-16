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
import { GEO_DATA } from './constants';
import { LiquidSwell, ThemeColor, ThemeFont, ThemeForm } from './liquid';
import { resolveMenuSettings } from './menus';
import { ThemeLoader } from './theme/theme-loader';
import {
  SECTION_GROUP_CONTENT,
  getSectionGroupProp,
  getAllSections,
  getPageSections,
  getLayoutSectionGroups,
  isObject,
  extractSettingsFromForm,
  scopeCustomCSS,
} from './utils';

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
  ThemePageSectionSchema,
  ThemePageTemplateConfig,
  ThemeLayoutSectionGroupConfig,
  SwellData,
  SwellMenu,
  SwellRecord,
  SwellAppConfig,
  SwellThemeConfig,
  SwellThemeVersion,
  SwellAppStorefrontThemeProps,
  SwellAppShopifyCompatibilityConfig,
  ThemePage,
  SwellPageRequest,
  ThemePageSchema,
  SwellSettingsGeo,
  ThemeSettingsBlock,
} from '../types/swell';

export class SwellTheme {
  public swell: Swell;
  public props: SwellAppStorefrontThemeProps;
  public globals: ThemeGlobals;
  public forms?: ThemeFormConfig[];
  public resources?: ThemeResources;
  public liquidSwell: LiquidSwell;

  public themeLoader: ThemeLoader;
  public themeConfigs: Map<string, SwellThemeConfig> | null = null;

  public page?: ThemeSettings;
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

  getSwellAppThemeProps(
    swellConfig?: SwellAppConfig,
  ): SwellAppStorefrontThemeProps {
    return (
      swellConfig?.storefront?.theme || ({} as SwellAppStorefrontThemeProps)
    );
  }

  async initGlobals(pageId: string): Promise<void> {
    this.pageId = pageId;

    await this.themeLoader.init(this.themeConfigs || undefined);

    const { store, session, menus, geo, configs } =
      await this.getSettingsAndConfigs();

    const { settings, request, page, cart, account, customer } =
      await this.resolvePageData(store, configs, pageId);

    this.page = page;

    const globals: ThemeGlobals = {
      ...this.globalData,
      store,
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
      canonical_url: `${store.url}${this.swell.url?.pathname || ''}`,
      // Flag to enable Shopify compatibility in sections and tags/filters
      shopify_compatibility: Boolean(settings.shopify_compatibility),
    };

    if (this.shopifyCompatibility) {
      this.shopifyCompatibility.initGlobals(globals);
    }

    this.setGlobals(globals);

    if (this.shopifyCompatibility) {
      this.shopifyCompatibility.adaptQueryParams();
    }
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
  }> {
    const geo = GEO_DATA;

    const [storefrontSettings, settingConfigs] = await Promise.all([
      this.swell.getStorefrontSettings(),
      this.getThemeConfigsByPath('theme/config/', '.json'),
    ]);

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
              console.error(`Error parsing ${configName} config: ${err}`);
              configValue = {};
            }
            acc[configName] = configValue;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      ),
    };

    const session = await this.swell.storefront.settings.session();

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
      store: storefrontSettings?.store,
      session,
      menus,
      geo,
      configs,
    };
  }

  async resolvePageData(
    store: SwellData,
    configs: ThemeConfigs,
    pageId?: string,
  ): Promise<{
    settings: ThemeSettings;
    request: SwellPageRequest;
    page: ThemePage;
    cart: SwellStorefrontSingleton | {};
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
      slug: undefined,
      description: undefined,
      $locale: undefined,
    } as ThemePage;

    if (pageId) {
      const templateConfig = await this.getThemeTemplateConfigByType(
        'templates',
        pageId,
      );

      let pageSchema: ThemePageSchema | undefined;
      try {
        pageSchema = JSON5.parse<ThemePageSchema>(
          templateConfig?.file_data || '{}',
        );
      } catch (err) {
        // noop
        console.warn(err);
      }

      if (pageSchema?.page) {
        const { slug, label, description, $locale } = pageSchema.page;

        page.slug = slug;
        page.label = label || page.label;
        page.description = description;
        page.$locale = $locale;
      }
    }

    const [cart, account] = await Promise.all([
      this.fetchSingletonResourceCached<StorefrontResource | {}>(
        'cart',
        () => this.fetchCart(),
        {},
      ),

      this.fetchSingletonResourceCached<StorefrontResource | null>(
        'account',
        () => this.fetchAccount(),
        null,
      ),
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
      cart,
      account: account as SwellStorefrontSingleton,
      customer: customer as SwellStorefrontSingleton, // Shopify only
    };
  }

  async fetchSingletonResourceCached<R>(
    key: string,
    handler: () => Promise<R>,
    defaultValue: R,
  ): Promise<R | undefined> {
    // Cookie should change when cart/account is updated
    const cacheKey = this.swell.storefront.session.getCookie();
    if (!cacheKey) {
      return defaultValue;
    }

    return this.swell.getCachedResource(`${key}-${cacheKey}`, [], () =>
      handler(),
    );
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

    if (!Object.keys(configs.editor).length && configs.settings_schema) {
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

    if (!Object.keys(configs.theme).length && configs.settings_data) {
      configs.theme = shopifyCompatibility().getThemeConfig(
        configs.settings_data,
      );
      this.themeSettingFilePath = 'theme/config/settings_data.json';
    }

    if (!Object.keys(configs.presets).length && configs.settings_data) {
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
    const allLocaleConfigs = await this.getThemeConfigsByPath(
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
        console.warn(err);
      }
    }

    return {};
  }

  resolveLookupSetting(
    setting: ThemeSettingFieldSchema,
    value: any,
  ): SwellData | SwellStorefrontRecord | SwellStorefrontCollection | null {
    if (value instanceof StorefrontResource) {
      return value;
    }

    const collection = resolveLookupCollection(setting);

    if (collection) {
      if (setting.multiple) {
        if (value instanceof Array) {
          return value.map((id: string) =>
            this.resolveLookupResource(collection, id),
          );
        }
      } else if (value !== '' && value !== null && value !== undefined) {
        return this.resolveLookupResource(collection, value);
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

  async getAllThemeConfigs(): Promise<Map<string, SwellThemeConfig>> {
    if (this.themeConfigs === null) {
      const configs = await this.themeLoader.loadTheme();

      const configsByPath = new Map<string, SwellThemeConfig>();
      for (const config of configs) {
        configsByPath.set(config.file_path, config);
      }

      this.themeConfigs = configsByPath;
    }

    return this.themeConfigs;
  }

  /**
   * Preloads updated theme configs. Used to optimize initial theme load.
   */
  async preloadThemeConfigs(
    version: SwellThemeVersion,
    configs: SwellThemeConfig[],
  ): Promise<void> {
    await this.themeLoader.preloadTheme(version, configs);
  }

  getPageConfigPath(pageId: string): string | null {
    if (this.shopifyCompatibility) {
      const configPath = this.shopifyCompatibility.getThemeFilePath(
        'templates',
        pageId,
      );

      return `theme/${configPath}.json`;
    }

    return `theme/templates/${pageId}.json`;
  }

  async getThemeConfig(filePath: string): Promise<SwellThemeConfig | null> {
    if (this.themeConfigs) {
      return this.themeConfigs.get(filePath) ?? null;
    }

    return this.themeLoader.fetchThemeConfig(filePath);
  }

  async getThemeConfigsByPath(
    pathPrefix: string,
    pathSuffix?: string,
  ): Promise<Map<string, SwellThemeConfig>> {
    const configs = await this.themeLoader.fetchThemeConfigsByPath(
      pathPrefix,
      pathSuffix,
    );

    const configsByPath = new Map<string, SwellThemeConfig>();
    for (const config of configs) {
      configsByPath.set(config.file_path, config);
    }

    return configsByPath;
  }

  async getThemeTemplateConfig(
    filePath: string,
  ): Promise<SwellThemeConfig | null> {
    // Explicit extension
    if (filePath.endsWith('.json') || filePath.endsWith('.liquid')) {
      return this.getThemeConfig(filePath);
    }

    // Try to find a JSON template first
    const jsonTemplate = await this.getThemeConfig(`${filePath}.json`);

    if (jsonTemplate) {
      return jsonTemplate;
    }

    return this.getThemeConfig(`${filePath}.liquid`);
  }

  async getThemeTemplateConfigByType(
    type: string,
    name: string,
  ): Promise<SwellThemeConfig | null> {
    const templatesByPriority = [`${type}/${name}`];

    if (this.shopifyCompatibility) {
      templatesByPriority.push(
        this.shopifyCompatibility.getThemeFilePath(type, name),
      );
    }

    for (const filePath of templatesByPriority) {
      const templateConfig = await this.getThemeTemplateConfig(
        `theme/${filePath}`,
      );

      if (templateConfig) {
        return templateConfig;
      }
    }

    return null;
  }

  async getAssetUrl(filePath: string): Promise<string | null> {
    // Asset support both inside and outside theme folder
    const assetConfig =
      (await this.getThemeConfig(`theme/assets/${filePath}`)) ||
      (await this.getThemeConfig(`assets/${filePath}`));

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
      return await this.liquidSwell.parseAndRender(template, data);
    } catch (err: any) {
      console.error(err);
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
      console.error(err);
      return '';
    }
  }

  async getSectionSchema(
    sectionName: string,
  ): Promise<Partial<ThemeSectionSchema> | undefined> {
    let result: Partial<ThemeSectionSchema> | undefined;

    const config = await this.getThemeTemplateConfigByType(
      'sections',
      sectionName,
    );

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
        console.warn(err);
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
        console.log(
          'Unable to render theme template',
          config.file_path,
          content,
        );
        throw new PageError(err as Error);
      }
    }

    return content;
  }

  async renderLayoutTemplate(name: string, data?: SwellData): Promise<string> {
    const templateConfig = await this.getThemeTemplateConfigByType(
      'layouts',
      name,
    );

    if (templateConfig) {
      const content = await this.renderThemeTemplate(
        templateConfig.file_path,
        data,
      );
      return typeof content === 'string'
        ? content
        : `<!-- invalid layout: ${name}--> {{ content_for_layout }}`;
    }

    throw new Error(`Layout template not found: ${name}`);
  }

  async renderPageTemplate(
    name: string,
    data?: SwellData,
    altTemplateId?: string,
  ): Promise<string | ThemePageTemplateConfig> {
    let templateConfig: SwellThemeConfig | null = null;

    if (altTemplateId) {
      templateConfig = await this.getThemeTemplateConfigByType(
        'templates',
        `${name}.${altTemplateId}`,
      );
    }

    if (!templateConfig) {
      templateConfig = await this.getThemeTemplateConfigByType(
        'templates',
        name,
      );
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
    if (this.page?.id) {
      pageConfig = await this.renderPageTemplate(
        this.page.id,
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

    const templateConfig = await this.getThemeTemplateConfigByType(
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

  async renderLayout(data?: SwellData): Promise<string> {
    if (this.liquidSwell.layoutName) {
      return this.renderLayoutTemplate(this.liquidSwell.layoutName, data);
    } else {
      // Render content directly when layout is `none`
      return data?.content_for_layout || '';
    }
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
        console.warn(err);
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
    const configs = await this.getThemeConfigsByPath('theme/sections/');
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

  /**
   * Get a list of sections and section groups in a page layout.
   *
   * Basically we should get these section groups: `header`, `content` and `footer`.
   * For now, section groups are searched for using regex in the page layout.
   * There may be cases where section groups can be nested in other files,
   * in which case they will not be visible to this function.
   *
   * In the future, we may use a dummy page renderer and thus extract all section groups.
   */
  async getPageSectionGroups(pageId: string): Promise<ThemeSectionGroupInfo[]> {
    const pageConfig = await this.getThemeTemplateConfigByType(
      'templates',
      pageId,
    );

    if (pageConfig === null) {
      return [];
    }

    const pageSchema = parseJsonConfig<ThemePageSchema>(pageConfig);
    const pageLayout = pageSchema.layout || 'theme';

    const layoutConfig = await this.getThemeTemplateConfigByType(
      'layouts',
      `${pageLayout}.liquid`,
    );

    if (layoutConfig === null) {
      return [];
    }

    const layoutData = layoutConfig.file_data;

    const iterator = layoutData.matchAll(
      /\bsections '(\w.*?)'|(\bcontent_for_layout\b)/gm,
    );

    const sections: ThemeSectionGroupInfo[] = [];
    for (const match of iterator) {
      if (match[1]) {
        // Layout section group
        const sectionFileName = match[1] || match[2];
        const sectionSchema = await this.getSectionSchema(sectionFileName);
        const sectionName = sectionSchema?.label || sectionFileName;

        // Layout section group
        const sectionConfig = await this.getThemeTemplateConfigByType(
          'sections',
          `${sectionFileName}.json`,
        );
        sections.push({
          prop: getSectionGroupProp(sectionFileName),
          label: sectionName,
          source: sectionConfig?.file_path as string,
        });
      } else if (match[2]) {
        // content_for_layout
        sections.push({
          prop: SECTION_GROUP_CONTENT,
          label: 'Template',
          source: pageConfig.file_path,
        });
      }
    }

    return sections;
  }

  async getLayoutSectionGroups(
    resolveSettings: boolean = true,
  ): Promise<ThemeLayoutSectionGroupConfig[]> {
    const configs = await this.getThemeConfigsByPath('theme/sections/');

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
            ? resolveSectionSettings(this, sectionConfig)
            : { ...sectionConfig.settings };

        const templateConfig = await this.getThemeTemplateConfigByType(
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
              settings?.section.custom_css,
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
    console.warn(err);
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
