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
  RenderPageSections,
  RenderTemplateString,
  RenderTranslation,
  ThemeSectionSchema,
} from 'types/swell';

export * from './color';
export * from './form';
export * from './font';

interface LiquidSwellOptions {
  theme: SwellTheme;
  getThemeConfig?: GetThemeConfig;
  getThemeTemplateConfigByType?: GetThemeTemplateConfigByType;
  getAssetUrl?: GetAssetUrl;
  renderTemplate?: RenderTemplate;
  renderTemplateString?: RenderTemplateString;
  renderPageSections?: RenderPageSections;
  renderTranslation?: RenderTranslation;
  renderCurrency?: RenderCurrency;
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
  public getThemeTemplateConfigByType: GetThemeTemplateConfigByType;
  public getAssetUrl: GetAssetUrl;
  public renderTemplate: RenderTemplate;
  public renderTemplateString: RenderTemplateString;
  public renderPageSections: RenderPageSections;
  public renderTranslation: RenderTranslation;
  public renderCurrency: RenderCurrency;

  public isEditor: boolean;
  public locale: string;
  public currency: string;
  public layoutName: string;
  public extName: string;
  public componentsDir: string;
  public sectionsDir: string;

  public lastSchema: ThemeSectionSchema | undefined;

  constructor({
    theme,
    getThemeConfig,
    getThemeTemplateConfigByType,
    getAssetUrl,
    renderTemplate,
    renderTemplateString,
    renderPageSections,
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
    getThemeConfig = getThemeConfig || theme.getThemeConfig.bind(theme);
    extName = extName || 'liquid';

    super({
      cache: false,
      relativeReference: false,
      fs: getLiquidFS(getThemeConfig, extName),
      ownPropertyOnly: false,
      operators: swellOperators,
    });

    this.theme = theme;
    this.getThemeConfig = getThemeConfig;
    this.getThemeTemplateConfigByType =
      getThemeTemplateConfigByType ||
      theme.getThemeTemplateConfigByType.bind(theme);
    this.getAssetUrl = getAssetUrl || theme.getAssetUrl.bind(theme);
    this.renderTemplate = renderTemplate || theme.renderTemplate.bind(theme);
    this.renderTemplateString =
      renderTemplateString || theme.renderTemplateString.bind(theme);
    this.renderPageSections =
      renderPageSections || theme.renderPageSections.bind(theme);
    this.renderTranslation =
      renderTranslation || theme.renderTranslation.bind(theme);
    this.renderCurrency = renderCurrency || theme.renderCurrency.bind(theme);
    this.isEditor = Boolean(isEditor);
    this.locale = locale || 'en-US';
    this.currency = currency || 'USD';
    this.layoutName = layoutName || 'theme';
    this.extName = extName;
    this.componentsDir = componentsDir || 'components';
    this.sectionsDir = sectionsDir || 'sections';
    this.lastSchema = undefined;

    bindTags(this);
    bindFilters(this);
  }

  async parseAndRender(template: string, data?: object): Promise<string> {
    return super.parseAndRender(template, data);
  }

  async resolveFilePathByType(
    type: string,
    name: string,
  ): Promise<string | undefined> {
    const config = await this.getThemeTemplateConfigByType(type, name);

    if (config?.file_path) {
      return config.file_path;
    }
  }

  async getComponentPath(componentName: string): Promise<string> {
    return (
      (await this.resolveFilePathByType('components', componentName)) ||
      resolveFilePath(`${this.componentsDir}/${componentName}`, this.extName)
    );
  }

  async getSectionPath(sectionName: string): Promise<string> {
    return (
      (await this.resolveFilePathByType('sections', sectionName)) ||
      resolveFilePath(`${this.sectionsDir}/${sectionName}`, this.extName)
    );
  }

  async getSectionGroupPath(sectionName: string): Promise<string> {
    return (
      (await this.resolveFilePathByType('sections', `${sectionName}.json`)) ||
      resolveFilePath(`${this.sectionsDir}/${sectionName}`, 'json')
    );
  }
}

function resolveFilePath(fileName: string, extName: string): string {
  return `theme/${fileName}.${extName}`;
}

function getLiquidFS(getThemeConfig: GetThemeConfig, extName: string): FS {
  return {
    /** read a file asynchronously */
    async readFile(filePath: string): Promise<string> {
      const resolvedPath = resolveFilePath(filePath, extName);
      return getThemeConfig(resolvedPath).then(
        (template) =>
          template?.file_data ||
          `<!-- theme template not found: ${resolvedPath} -->`,
      );
    },
    /** check if a file exists asynchronously */
    async exists(_filePath: string): Promise<boolean> {
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
