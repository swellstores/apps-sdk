import { Liquid, type FS } from 'liquidjs';

import { SwellTheme } from '../theme';
import { bindTags } from './tags';
import { bindFilters } from './filters';
import { swellOperators } from './operators';

import type {
  GetAssetUrl,
  GetThemeConfig,
  GetThemeTemplateConfigByType,
  RenderCurrency,
  RenderTemplate,
  RenderTemplateSections,
  RenderTemplateString,
  RenderTranslation,
  ThemeSectionSchema,
} from 'types/swell';

export * from './color';
export * from './form';
export * from './font';

 interface LiquidSwellOptions {
  theme: SwellTheme;
  getThemeConfig: GetThemeConfig;
  getThemeTemplateConfigByType?: GetThemeTemplateConfigByType;
  getAssetUrl: GetAssetUrl;
  renderTemplate: RenderTemplate;
  renderTemplateString: RenderTemplateString;
  renderTemplateSections: RenderTemplateSections;
  renderTranslation: RenderTranslation;
  renderCurrency: RenderCurrency;
  isEditor: boolean;
  locale?: string;
  currency?: string;
  layoutName?: string;
  extName?: string;
  componentsDir?: string;
  sectionsDir?: string;
}

export class LiquidSwell extends Liquid {
  public theme: SwellTheme;
  public getThemeConfig: GetThemeConfig;
  public getThemeTemplateConfigByType: GetThemeTemplateConfigByType | undefined;
  public getAssetUrl: GetAssetUrl;
  public renderTemplate: RenderTemplate;
  public renderTemplateString: RenderTemplateString;
  public renderTemplateSections: RenderTemplateSections;
  public renderTranslation: RenderTranslation;
  public renderCurrency: RenderCurrency;
  public engine: Liquid;

  public isEditor: boolean;
  public locale: string | undefined;
  public currency: string | undefined;
  public layoutName: string | undefined;
  public extName: string | undefined;
  public componentsDir: string | undefined;
  public sectionsDir: string | undefined;

  public lastSchema: ThemeSectionSchema | undefined;

  constructor({
    theme,
    getThemeConfig,
    getThemeTemplateConfigByType,
    getAssetUrl,
    renderTemplate,
    renderTemplateString,
    renderTemplateSections,
    renderTranslation,
    renderCurrency,
    isEditor,
    locale,
    currency,
    layoutName,
    extName,
    componentsDir,
    sectionsDir,
  }: LiquidSwellOptions) {
    super();

    this.theme = theme;
    this.getThemeConfig = getThemeConfig || theme.getThemeConfig.bind(theme);
    this.getThemeTemplateConfigByType =
      getThemeTemplateConfigByType ||
      theme.getThemeTemplateConfigByType.bind(theme);
    this.getAssetUrl = getAssetUrl || theme.getAssetUrl.bind(theme);
    this.renderTemplate = renderTemplate || theme.renderTemplate.bind(theme);
    this.renderTemplateString =
      renderTemplateString || theme.renderTemplateString.bind(theme);
    this.renderTemplateSections =
      renderTemplateSections || theme.renderTemplateSections.bind(theme);
    this.renderTranslation =
      renderTranslation || theme.renderTranslation.bind(theme);
    this.renderCurrency = renderCurrency || theme.renderCurrency.bind(theme);
    this.isEditor = isEditor;
    this.locale = locale || 'en-US';
    this.currency = currency || 'USD';
    this.layoutName = layoutName || 'theme';
    this.extName = extName || 'liquid';
    this.componentsDir = componentsDir || 'components';
    this.sectionsDir = sectionsDir || 'sections';

    this.engine = this.initLiquidEngine();
  }

  initLiquidEngine(): Liquid {
    this.engine = new Liquid({
      cache: false,
      relativeReference: false,
      fs: this.getLiquidFS(),
      ownPropertyOnly: false,
      operators: swellOperators,
    });

    bindTags(this);
    bindFilters(this);

    return this.engine;
  }

  getLiquidFS(): FS {
    const { getThemeConfig, resolveFilePath } = this;
    return {
      /** read a file asynchronously */
      async readFile(filePath: string): Promise<string> {
        const resolvedPath = resolveFilePath(filePath);
        return getThemeConfig(resolvedPath).then(
          (template) =>
            template?.file_data ||
            `<!-- theme template not found: ${resolvedPath} -->`,
        );
      },
      /** check if a file exists asynchronously */
      async exists(filePath: string): Promise<boolean> {
        return true;
      },
      /** read a file synchronously */
      readFileSync(_filePath: string): string {
        return '';
      },
      /** check if a file exists synchronously */
      existsSync(_filePath: string): boolean {
        return false;
      },
      /** check if file is contained in `root`, always return `true` by default. Warning: not setting this could expose path traversal vulnerabilities. */
      contains(_root: string, _file: string): boolean {
        return true;
      },
      /** resolve a file against directory, for given `ext` option */
      resolve(_dir: string, file: string, _ext: string): string {
        return file;
      },
      /** fallback file for lookup failure */
      fallback(_filePath: string): string | undefined {
        return;
      },
    };
  }

  async parseAndRender(template: string, data: any): Promise<string> {
    return this.engine.parseAndRender(template, data);
  }

  resolveFilePath(fileName: string, extName?: string): string {
    return `theme/${fileName}.${extName || this.extName}`;
  }

  async resolveFilePathByType(
    type: string,
    name: string,
  ): Promise<string | undefined> {
    if (this.getThemeTemplateConfigByType) {
      const config = await this.getThemeTemplateConfigByType(type, name);
      if (config?.file_path) {
        return config.file_path;
      }
    }
  }

  async getComponentPath(componentName: string): Promise<string> {
    return (
      (await this.resolveFilePathByType('components', componentName)) ||
      this.resolveFilePath(`${this.componentsDir}/${componentName}`)
    );
  }

  async getSectionPath(sectionName: string): Promise<string> {
    return (
      (await this.resolveFilePathByType('sections', sectionName)) ||
      this.resolveFilePath(`${this.sectionsDir}/${sectionName}`)
    );
  }

  async getSectionGroupPath(sectionName: string): Promise<string> {
    return (
      (await this.resolveFilePathByType('sections', `${sectionName}.json`)) ||
      this.resolveFilePath(`${this.sectionsDir}/${sectionName}`, 'json')
    );
  }
}
