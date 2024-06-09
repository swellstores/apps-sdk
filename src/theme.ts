import clone from "lodash/clone";
import get from "lodash/get";
import each from 'lodash/each';
import reduce from 'lodash/reduce';
import {
  Swell,
  StorefrontResource,
  SwellStorefrontCollection,
  SwellStorefrontRecord,
  SwellStorefrontSingleton,
} from './api';
import { LiquidSwell, ThemeColor, ThemeFont, ThemeForm } from './liquid';
import { ShopifyCompatibility } from './compatibility/shopify';
import ShopifyCustomer from './compatibility/shopify-objects/customer';
import ShopifyCart from './compatibility/shopify-objects/cart';
import { resolveMenuSettings } from './menus';
import {
  themeConfigQuery,
  getAllSections,
  getPageSections,
  getLayoutSectionGroups,
  isObject,
} from './utils';

export class SwellTheme {
  public swell: Swell;
  public storefrontConfig?: SwellStorefrontConfig;
  public liquidSwell: LiquidSwell;

  public page: any;
  public pageId: string | undefined;
  public globals: ThemeGlobals | undefined;
  public request: ThemeSettings | null = null;
  public shopifyCompatibility: any = null;
  public shopifyCompatibilityClass: typeof ShopifyCompatibility =
    ShopifyCompatibility;

  public formData: { [key: string]: ThemeForm } = {};
  public globalData: SwellData = {};

  constructor(
    swell: Swell,
    options: {
      storefrontConfig?: SwellStorefrontConfig;
      shopifyCompatibilityClass?: typeof ShopifyCompatibility;
    } = {},
  ) {
    const { storefrontConfig, shopifyCompatibilityClass } = options;

    this.swell = swell;

    this.storefrontConfig = storefrontConfig;
    this.shopifyCompatibilityClass =
      shopifyCompatibilityClass || ShopifyCompatibility;

    this.liquidSwell = new LiquidSwell({
      theme: this as any,
      getThemeConfig: this.getThemeConfig.bind(this),
      getAssetUrl: this.getAssetUrl.bind(this),
      getThemeTemplateConfigByType:
        this.getThemeTemplateConfigByType.bind(this),
      renderTemplate: this.renderTemplate.bind(this),
      renderTemplateString: this.renderTemplateString.bind(this),
      renderTemplateSections: this.renderTemplateSections.bind(this),
      renderLanguage: this.lang.bind(this),
      renderCurrency: this.renderCurrency.bind(this),
      isEditor: swell.isEditor,
    });
  }

  async initGlobals(pageId: string) {
    this.pageId = pageId;

    const { store, menus, geo, configs } = await this.getSettingsAndConfigs();
    const { settings, page, cart, account, customer } =
      await this.resolvePageData(configs, pageId);

    this.page = page;

    this.setGlobals({
      ...this.globalData,
      store,
      settings,
      menus,
      page,
      cart,
      account,
      customer,
      geo,
      configs,
      storefrontConfig: this.storefrontConfig,
      language: configs?.language,
      canonical_url: `${store.url}${this.swell.url?.pathname || ''}`,
      // Flag to enable Shopify compatibility in sections and tags/filters
      shopify_compatibility: Boolean(settings.shopify_compatibility),
    });

    if (this.shopifyCompatibility) {
      this.shopifyCompatibility.adaptQueryParams();
    }
  }

  setGlobals(globals: SwellData) {
    // Note: All globals are set manually on the client side in the editor
    if (this.shopifyCompatibility && !this.globals) {
      this.shopifyCompatibility.adaptGlobals(globals);
    }

    this.globals = {
      ...this.globals,
      ...globals,
    };
    this.liquidSwell.globals = this.globals;
    this.liquidSwell.engine.options.globals = this.globals;
  }

  async getSettingsAndConfigs(): Promise<{
    store: SwellData;
    menus: { [key: string]: SwellMenu };
    configs: ThemeConfigs;
    geo: SwellRecord;
  }> {
    const [storefrontSettings, themeConfigs, geo] = await Promise.all([
      this.swell.getCached('store-settings', async () => {
        return await this.swell.getStorefrontSettings();
      }),
      this.getAllThemeConfigs(),
      this.getGeoSettings(),
    ]);

    const settingConfigs = await Promise.all(
      (themeConfigs?.results || [])
        .filter((config: SwellRecord) =>
          config?.file_path?.startsWith('theme/config/'),
        )
        .map(async (config: SwellRecord) => {
          if (config?.file_path?.endsWith('.json')) {
            return await this.getThemeConfig(config.file_path);
          }
          return config;
        }),
    );

    const configs: ThemeConfigs = {
      theme: {},
      editor: {},
      language: {},
      presets: [],
      ...settingConfigs.reduce(
        (acc: any, config: SwellRecord | null): { [key: string]: any } => {
          const configName = config?.name.split('.')[0];
          if (configName) {
            let configValue;
            if (config?.file_path?.endsWith('.json')) {
              try {
                configValue = JSON.parse(config.file_data);
              } catch (err) {
                configValue = null;
              }
            }
            return {
              ...acc,
              [configName]: configValue,
            };
          }
          return acc;
        },
        {},
      ),
    };

    const localeCode = storefrontSettings?.store?.locale || 'en-US';

    this.resolveLanguageLocale(configs.language, localeCode);

    await this.setCompatibilityConfigs(configs, themeConfigs, localeCode);

    // Resolve menus after compatibility is determined
    const menus = await resolveMenuSettings(
      this as any,
      this.swell.getStorefrontMenus(),
      {
        currentUrl: this.swell.url.pathname,
      },
    );

    return {
      store: storefrontSettings?.store,
      menus,
      geo,
      configs,
    };
  }

  async resolvePageData(
    configs: SwellData,
    pageId?: string,
  ): Promise<{
    settings: ThemeSettings;
    page: ThemeSettings;
    cart: SwellStorefrontSingleton | object;
    account: SwellStorefrontSingleton | null;
    customer?: SwellStorefrontSingleton | null;
  }> {
    const { settings, page } = this.swell.getCachedSync(
      'theme-settings-resolved',
      [this.swell.url.pathname, pageId],
      () => {
        const settings = resolveThemeSettings(
          this,
          configs.theme,
          configs.editor?.settings,
        );
        return {
          settings,
          page: this.storefrontConfig?.pages?.find(
            (page: ThemeSettings) => page.id === pageId,
          ),
        };
      },
    );

    const [cart, account] = await Promise.all([
      this.fetchSingletonResourceCached('cart', () => this.fetchCart(), {}),
      this.fetchSingletonResourceCached(
        'account',
        () => this.fetchAccount(),
        null,
      ),
    ]);

    // TODO: move this to compatibility class
    let customer;
    if (this.shopifyCompatibility) {
      customer = account;
    }

    return {
      settings,
      page,
      cart,
      account,
      customer, // Shopify only
    };
  }

  fetchSingletonResourceCached(
    key: string,
    handler: () => any,
    defaultValue: any,
  ) {
    // Cookie should change when cart/account is updated
    const cacheKey = this.swell.storefront.session.getCookie();
    if (!cacheKey) {
      return defaultValue;
    }

    return this.swell.getCachedResource(`${key}-${cacheKey}`, () => handler());
  }

  async fetchCart() {
    const cart = new SwellStorefrontSingleton(this.swell as any, 'cart');

    await cart.id;
    if (!cart.id) {
      return {};
    }

    if (this.shopifyCompatibility) {
      const compatProps = ShopifyCart(this.shopifyCompatibility, cart as any);
      cart.setCompatibilityProps(compatProps);
    }

    return cart;
  }

  async fetchAccount() {
    const account = new SwellStorefrontSingleton(this.swell as any, 'account');

    await account.id;
    if (!account.id) {
      return null;
    }

    if (this.shopifyCompatibility) {
      const compatProps = ShopifyCustomer(
        this.shopifyCompatibility,
        account as any,
      );
      account.setCompatibilityProps(compatProps);
    }

    return account;
  }

  setFormData(
    formId: string,
    options: {
      params?: any;
      success?: boolean;
      errors?: ThemeFormErrorMessages;
    },
  ) {
    const form = this.formData[formId] || new ThemeForm(formId);

    if (form instanceof ThemeForm) {
      if (options?.params) {
        form.setParams(options.params);
      }
      if (options?.errors) {
        form.setSuccess(false);
        form.setErrors(options.errors);
      } else if (options?.success) {
        form.setSuccess(true);
        form.clearErrors();
      }

      if (this.shopifyCompatibility) {
        Object.assign(form, this.shopifyCompatibility.getFormData(form));
      }
    }

    this.formData[formId] = form;

    this.setGlobals({ forms: this.formData });
  }

  serializeFormData(): SwellData | null {
    const serializedFormData: SwellData = {};

    for (const formId in this.formData) {
      serializedFormData[formId] = {
        success: this.formData[formId].success,
        errors: this.formData[formId].errors,
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

  resolveLanguageLocale(languageConfig: ThemeSettings, localeCode: string) {
    if (!languageConfig) {
      return {};
    }

    const localeShortCode = localeCode.split('-')[0];

    return reduce(
      languageConfig,
      (acc: any, value: any, key: string) => {
        if (isObject(value)) {
          acc[key] = this.resolveLanguageLocale(value, localeCode);
        } else {
          acc[key] =
            get(languageConfig, `$locale.${localeCode}.${key}`) ||
            get(languageConfig, `$locale.${localeShortCode}.${key}`) ||
            value;
        }
        return acc;
      },
      {},
    );
  }

  async setCompatibilityConfigs(
    configs: ThemeConfigs,
    themeConfigs: SwellCollection,
    localeCode: string,
  ) {
    const shopifyCompatibility = () => {
      if (!this.shopifyCompatibility) {
        this.shopifyCompatibility = new this.shopifyCompatibilityClass(
          this.swell,
        );
      }
      return this.shopifyCompatibility;
    };

    if (!Object.keys(configs.editor).length && configs.settings_schema) {
      configs.editor = shopifyCompatibility().getEditorConfig(
        configs.settings_schema,
      );
    }

    if (!Object.keys(configs.theme).length && configs.settings_data) {
      configs.theme = shopifyCompatibility().getThemeConfig(
        configs.settings_data,
      );
    }

    if (!Object.keys(configs.presets).length && configs.settings_data) {
      configs.presets = shopifyCompatibility().getPresetsConfig(
        configs.settings_data,
      );
    }

    if (!Object.keys(configs.language).length) {
      configs.language = await shopifyCompatibility().getLocaleConfig(
        themeConfigs,
        localeCode,
        this.getThemeConfig.bind(this),
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

  resolveLookupSetting(
    setting: ThemeSettingFieldSchema,
    value: any,
  ): SwellData | SwellStorefrontRecord | SwellStorefrontCollection | null {
    if (value instanceof StorefrontResource) {
      return value;
    }

    const collection = resolveLookupCollection(setting);

    if (collection) {
      const defaultHandler = () => {
        if (setting.multi) {
          return new SwellStorefrontCollection(this.swell as any, collection, {
            limit: setting.limit || 15,
          });
        } else if (value !== null && value !== undefined) {
          return new SwellStorefrontRecord(
            this.swell as any,
            collection,
            value,
          );
        }
        return null;
      };

      if (this.shopifyCompatibility) {
        return this.shopifyCompatibility.getLookupData(
          collection,
          setting,
          value,
          defaultHandler,
        );
      }

      return defaultHandler();
    }

    return null;
  }

  resolveMenuSetting(value: string): SwellMenu | null {
    if (!value) {
      return null;
    }

    const allMenus = this.globals?.menus || {};
    const menu = allMenus[value] || allMenus[value.replace(/-/g, '_')];

    return menu || null;
  }

  async lang(key: string, data?: any, fallback?: string): Promise<string> {
    return await this.renderLanguage(key, data, fallback);
  }

  resolveFontSetting(value: string): ThemeFont | null {
    if (this.shopifyCompatibility) {
      const fontSetting =
        this.shopifyCompatibility.getFontFromShopifySetting(value);

      const adaptedFont = new ThemeFont(fontSetting || value);
      Object.assign(
        adaptedFont,
        this.shopifyCompatibility.getFontData(adaptedFont),
      );

      return adaptedFont;
    }

    return new ThemeFont(value);
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

  themeConfigQuery() {
    const { swellHeaders } = this.swell;
    return themeConfigQuery(swellHeaders);
  }

  async getGeoSettings(): Promise<SwellRecord> {
    const cacheKey = this.swell.swellHeaders['theme-config-version'];

    return this.swell.getCached(
      'geo-settings',
      [cacheKey],
      async () => {
        return await this.swell.get('/settings/geo');
      },
      // 1hr cache time
      1000 * 60 * 60,
    );
  }

  async getAllThemeConfigs(): Promise<SwellCollection> {
    const cacheKey = this.swell.swellHeaders['theme-config-version'];

    return this.swell.getCached('theme-configs-all', [cacheKey], async () => {
      console.log(`Retrieving theme configurations - version: ${cacheKey}`);

      const configs = await this.swell.get('/:themes:configs', {
        ...this.themeConfigQuery(),
        // TODO: paginate to support more than 1000 configs
        limit: 1000,
        fields: 'type, name, file, file_path',
        include: {
          file_data: {
            url: '/:themes:configs/{id}/file/data',
            conditions: {
              type: 'theme',
              // Only expand theme files
              // Do not expand non-text data
              file: {
                $and: [
                  { content_type: { $regex: '^(?!image)' } },
                  { content_type: { $regex: '^(?!video)' } },
                ],
              },
              // Do not return assets unless they end with .liquid.[ext]
              $or: [
                { file_path: { $regex: '^(?!theme/assets/)' } },
                { file_path: { $regex: '.liquid.[a-zA-Z0-9]+$' } },
              ],
            },
          },
        },
      });

      return configs;
    });
  }

  async getThemeConfig(filePath: string): Promise<SwellThemeConfig | null> {
    if (!this.swell.swellHeaders['theme-id']) {
      return null;
    }

    const allConfigs = await this.getAllThemeConfigs();
    const config = allConfigs?.results?.find(
      (config: any) => config.file_path === filePath,
    );

    if (config && config.file_data === undefined) {
      config.file_data = await this.swell.getCached(
        'theme-config-filedata',
        [filePath, config.file?.md5],
        async () => {
          return await this.swell.get(
            `/:themes:configs/${config.id}/file/data`,
          );
        },
      );
    }

    return config as SwellThemeConfig;
  }

  async getThemeTemplateConfig(
    filePath: string,
  ): Promise<SwellThemeConfig | null> {
    // Explicit extension
    if (filePath.endsWith('.json') || filePath.endsWith('.liquid')) {
      return await this.getThemeConfig(filePath);
    }

    // Try to find a JSON template first
    const jsonTemplate = await this.getThemeConfig(`${filePath}.json`);
    if (jsonTemplate) {
      return jsonTemplate;
    }

    return await this.getThemeConfig(`${filePath}.liquid`);
  }

  async getThemeTemplateConfigByType(
    type: string,
    name: string,
  ): Promise<SwellThemeConfig | null | undefined> {
    const templatesByPriority = [
      `${type}/${name}`,
      ...(this.shopifyCompatibility
        ? [this.shopifyCompatibility.getThemeFilePath(type, name)]
        : []),
    ];

    for (const filePath of templatesByPriority) {
      const templateConfig = await this.getThemeTemplateConfig(
        `theme/${filePath}`,
      );
      if (templateConfig) {
        return templateConfig;
      }
    }
  }

  getAssetUrl(filePath: string): string | null {
    const cacheKey = this.swell.swellHeaders['theme-config-version'];

    const configs = this.swell.getCachedSync('theme-configs-all', [cacheKey]);

    const assetConfig =
      configs?.results?.find(
        (config: SwellRecord) =>
          // Asset support both inside and outside theme folder
          config.file_path === `theme/assets/${filePath}` ||
          config.file_path === `assets/${filePath}`,
      ) || null;

    return assetConfig?.file?.url || null;
  }

  async renderTemplate(
    config: SwellThemeConfig | null,
    data?: SwellData,
  ): Promise<string> {
    const template = config?.file_data || null;

    if (config === null) {
      return '';
    } else if (template === null) {
      return `<!-- template not found: ${config?.file_path} -->`;
    }

    try {
      return await this.liquidSwell.engine.parseAndRender(template, data);
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
      return await this.liquidSwell.engine.parseAndRender(templateString, {
        ...data,
      });
    } catch (err: any) {
      console.error(err);
      return ``;
    }
  }

  async getSectionSchema(
    sectionName: string,
  ): Promise<ThemeSectionSchema | undefined> {
    const config = await this.getThemeTemplateConfigByType(
      'sections',
      sectionName,
    );
    if (config?.file_path?.endsWith('.json')) {
      try {
        return JSON.parse(config.file_data) || undefined;
      } catch {
        // noop
      }
    } else if (config?.file_path?.endsWith('.liquid')) {
      // Fallback to the liquid file schema
      if (this.shopifyCompatibility) {
        this.liquidSwell.lastSchema = undefined;

        await this.renderTemplate(config);

        const schema = this.liquidSwell.lastSchema;
        if (schema) {
          const result =
            this.shopifyCompatibility.getSectionConfigSchema(schema);
          return result;
        }
      }
    }
  }

  async renderThemeTemplate(
    filePath: string,
    data?: SwellData,
  ): Promise<string | ThemeSectionGroup> {
    const config = await this.getThemeTemplateConfig(filePath);
    const content = await this.renderTemplate(config, {
      ...data,
      template: config,
    });

    if (content && config?.file_path?.endsWith('.json')) {
      try {
        return JSON.parse(content);
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
  ): Promise<string | ThemeSectionGroup> {
    let templateConfig;
    if (altTemplateId) {
      templateConfig = await this.getThemeTemplateConfigByType(
        'pages',
        `${name}.${altTemplateId}`,
      );
    }

    templateConfig =
      templateConfig ||
      (await this.getThemeTemplateConfigByType('pages', name));

    if (templateConfig) {
      const themeTemplate = await this.renderThemeTemplate(
        templateConfig.file_path,
        data,
      );
      if (themeTemplate && typeof themeTemplate !== 'string') {
        themeTemplate.id = templateConfig.name;
      }
      return themeTemplate;
    }

    throw new Error(`Page template not found: ${name}`);
  }

  async renderPage(
    pageData?: SwellData,
    altTemplateId?: string,
  ): Promise<string | ThemeSectionGroup> {
    // Set page data as globals
    if (pageData) {
      this.setGlobals(pageData);
    }

    if (this.page?.id) {
      return await this.renderPageTemplate(
        this.page.id,
        pageData,
        altTemplateId,
      );
    } else {
      return await this.renderPageTemplate('404', pageData);
    }
  }

  async renderAllSections(
    sectionsIds: string | Array<string>,
    pageData?: SwellData,
  ): Promise<{ [key: string]: string }> {
    const sections =
      typeof sectionsIds === 'string'
        ? sectionsIds.split(/\s*,\s*/)
        : sectionsIds;

    const sectionsRendered = await Promise.all(
      sections.map?.((sectionId) => {
        return this.renderSection(sectionId, pageData);
      }),
    );

    return sectionsRendered.reduce((acc: any, section: any, index: number) => {
      const sectionId = sections[index];
      if (this.shopifyCompatibility) {
        // TODO: figure out a way to use compatibility class for this
        acc[sectionId] = `
          <div id="shopify-section-${sectionId}" class="shopify-section">${section}</div>
        `.trim();
      } else {
        acc[sectionId] = `
          <div id="swell-section-${sectionId}" class="swell-section">${section}</div>
        `.trim();
      }
      return acc;
    }, {});
  }

  async renderSection(
    sectionId: string,
    pageData?: SwellData,
  ): Promise<string | ThemeSectionGroup> {
    // Set page data as globals
    if (pageData) {
      this.setGlobals(pageData);
    }

    // Section ID could be a section name or a given config ID within a template
    const [sectionKey, pageId] = sectionId
      ?.split(/\_\_/) // Split generated IDs if needed
      .reverse();

    let templateConfig = await this.getThemeTemplateConfigByType(
      pageId ? 'pages' : 'sections',
      pageId ? pageId : sectionKey,
    );

    if (templateConfig) {
      const sectionContent = await this.renderThemeTemplate(
        templateConfig.file_path,
        pageData,
      );

      // Render a section of a page template
      if (pageId && (sectionContent as ThemeSectionGroup)?.sections) {
        const pageSectionGroup = {
          id: templateConfig.name,
          sections: {
            [sectionKey]: (sectionContent as ThemeSectionGroup)?.sections?.[
              sectionKey
            ],
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
      return await this.renderLayoutTemplate(this.liquidSwell.layoutName, data);
    } else {
      // Render content directly when layout is `none`
      return data?.content_for_layout || '';
    }
  }

  getContentForHeader(): string {
    let content = '\n';

    // Include google font stylesheet for all font settings
    content += this.renderFontHeaderLinks();

    if (this.shopifyCompatibility) {
      content += `\n${this.shopifyCompatibility.getContentForHeader()}`;
    }

    return content;
  }

  renderFontHeaderLinks() {
    const themeSettings = this.globals?.configs?.theme;
    const editorSettings = this.globals?.configs?.editor?.settings || [];

    if (themeSettings && editorSettings) {
      const fontSettings = findThemeSettingsByType(
        'font_family',
        themeSettings,
        editorSettings,
      );

      const combinedFonts: string[] = [];
      for (let i = 0; i < fontSettings.length; i++) {
        const value = fontSettings[i].value;
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

  async getTemplateSchema(config: SwellThemeConfig): Promise<any> {
    let schema = {};

    const resolvedConfig = await this.getThemeConfig(config.file_path);

    if (resolvedConfig?.file_path?.endsWith('.liquid')) {
      if (this.shopifyCompatibility) {
        // Extract {% schema %} from liquid files for Shopify compatibility
        this.liquidSwell.lastSchema = undefined;
        await this.renderTemplate(resolvedConfig);
        const lastSchema = this.liquidSwell.lastSchema || {};
        if (lastSchema) {
          schema = this.shopifyCompatibility.getSectionConfigSchema(lastSchema);
        }
      }
    } else if (resolvedConfig?.file_data) {
      try {
        schema = JSON.parse(resolvedConfig?.file_data) || undefined;
      } catch {
        // noop
      }
    }

    return schema;
  }

  async getAllSections(): Promise<ThemePageSectionSchema[]> {
    const configs = await this.getAllThemeConfigs();
    return await getAllSections(configs, this.getTemplateSchema.bind(this));
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

  async getLayoutSectionGroups(
    resolveSettings: boolean = true,
  ): Promise<ThemeLayoutSectionGroupConfig[]> {
    const configs = await this.getAllThemeConfigs();
    // TODO: de-dupe with getAllSections
    let layoutSectionGroups = await getLayoutSectionGroups(
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
    const sectionConfigs = await this.getPageSections(sectionGroup);
    return this.renderSectionConfigs(sectionConfigs, data);
  }

  async renderSectionConfigs(
    sectionConfigs: ThemeSectionConfig[],
    data?: SwellData,
  ): Promise<ThemeSectionConfig[]> {
    return await Promise.all(
      sectionConfigs.map((sectionConfig: ThemeSectionConfig, index: number) => {
        const { section, schema } = sectionConfig;
        let { settings } = sectionConfig;

        if (schema?.fields && this.globals) {
          settings = resolveSectionSettings(this, sectionConfig);
        }

        return new Promise(async (resolve) => {
          const templateConfig = await this.getThemeTemplateConfigByType(
            'sections',
            `${section.type}.liquid`,
          );
          const output = templateConfig
            ? await this.renderTemplate(templateConfig, {
                ...data,
                ...settings,
                index,
                template: templateConfig,
              })
            : '';

          resolve({
            ...sectionConfig,
            output,
          });
        }) as Promise<ThemeSectionConfig>;
      }),
    );
  }

  async renderTemplateSections(
    sectionGroup: ThemeSectionGroup,
    data: SwellData,
  ) {
    const sectionConfigs = await this.renderPageSections(sectionGroup, data);

    return sectionConfigs
      .map(
        (section: any) =>
          `<${section.tag} ${section.class ? `class="${section.class}"` : ''}>${
            section.output
          }</${section.tag}>`,
      )
      .join('\n');
  }

  async renderLanguage(
    key: string,
    data?: any,
    fallback?: string,
  ): Promise<string> {
    if (key === undefined) {
      return fallback || '';
    }

    const lang = this.globals?.language;
    const localeCode = String(this.globals?.store?.locale || '') || 'en-US';
    const keyParts = key?.split('.') || [];
    const keyName = keyParts.pop() || '';
    const keyPath = keyParts.join('.');
    const langObject = get(lang, keyPath);

    let localeValue =
      get(langObject?.[localeCode], keyName) ||
      get(langObject?.[localeCode.split('-')[0]], keyName) ||
      langObject?.[keyName];

    // Plural vs singular language
    if (data?.count !== undefined && localeValue?.one) {
      localeValue = data.count === 1 ? localeValue.one : localeValue.other;
    }

    if (typeof localeValue !== 'string') {
      return fallback || '';
    }

    const result = await this.renderTemplateString(localeValue, data);

    return result || fallback || '';
  }

  renderCurrency(amount: number, params: any): string {
    // FIXME: Total hack because on the client side the currency is getting set to `[object Promise]` for some reason
    const settingState = (this.swell.storefront.settings as any).state;
    const code = ((this.swell.storefront.currency as any).code =
      settingState?.store?.currency || 'USD');
    (this.swell.storefront.currency as any).locale =
      settingState?.store?.locale || 'en-US';
    (this.swell.storefront.currency as any).state =
      settingState?.store?.locales?.find(
        (locale: any) => locale.code === code,
      ) || { code };

    return this.swell.storefront.currency.format(amount, params);
  }
}

export class PageError {
  public statusCode: number = 500;
  public message: string | Error;
  public template: string;

  constructor(
    title: string | Error = 'Something went wrong',
    template: string = '500',
  ) {
    this.message = String(title);
    this.template = template;
  }

  toString() {
    return this.message;
  }
}

export class PageNotFound extends PageError {
  constructor(message: string = 'Page not found', template: string = '404') {
    super(message, template);
    this.statusCode = 404;
  }
}

export function resolveSectionSettings(
  theme: SwellTheme,
  sectionConfig: ThemeSectionConfig,
): ThemeSectionSettings | undefined {
  const { settings, schema } = sectionConfig;

  if (!settings?.section?.settings || !schema?.fields) {
    return settings;
  }

  const editorSettings: ThemeSettingSectionSchema[] = [
    {
      label: sectionConfig.id,
      fields: schema.fields,
    },
  ];

  return {
    ...settings,
    section: {
      ...settings.section,
      settings: resolveThemeSettings(
        theme,
        settings.section.settings,
        editorSettings,
      ),
      blocks: settings.section.blocks?.map((block) => ({
        ...block,
        settings: resolveThemeSettings(
          theme,
          block.settings,
          schema.blocks?.filter(
            (schemaBlock) => schemaBlock.type === block.type,
          ),
        ),
      })),
    },
  };
}

export function resolveThemeSettings(
  theme: SwellTheme,
  themeSettings: ThemeSettings,
  editorSchemaSettings?: ThemeSettingSectionSchema[],
): ThemeSettings {
  const settings = clone(themeSettings);
  each(settings, (value, key) => {
    const setting =
      editorSchemaSettings && findEditorSetting(editorSchemaSettings, key);
    if (isObject(value) && !(value instanceof StorefrontResource)) {
      // Object-based setting types
      switch (setting?.type) {
        case 'color_scheme_group':
          each(value, (_, schemeId) => {
            each(value[schemeId].settings, (colorValue, colorId) => {
              if (colorValue) {
                value[schemeId].settings[colorId] = new ThemeColor(colorValue);
              }
            });
          });
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
        case 'font_family':
          settings[key] = theme.resolveFontSetting(value);
          break;
        case 'menu':
          settings[key] = theme.resolveMenuSetting(value);
          break;
        case 'url':
          settings[key] = theme.resolveUrlSetting(value);
          break;
      }
    }
  });

  return settings;
}

export function findThemeSettingsByType(
  type: string,
  themeSettings: ThemeSettings,
  editorSchemaSettings: ThemeSettingSectionSchema[],
): Array<{ setting: any; value: any }> {
  const foundSettings: Array<{ setting: any; value: any }> = [];

  each(themeSettings, (value, key) => {
    if (isObject(value)) {
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
  }
}

export function findEditorSetting(
  editorSchemaSettings: ThemeSettingSectionSchema[],
  key: string,
) {
  for (const section of editorSchemaSettings || []) {
    for (const field of section.fields) {
      if (field.id === key) {
        return field;
      }
    }
  }
}