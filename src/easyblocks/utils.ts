import JSON5 from 'json5';

import type { ShopifySectionSchema, ShopifySectionGroup } from 'types/shopify';

import type {
  SwellThemeConfig,
  SwellLocaleProp,
  ThemeLayoutSectionGroupConfig,
  ThemeSection,
  ThemeSectionBase,
  ThemeSectionConfig,
  ThemeSectionGroup,
  ThemeSectionSchema,
  ThemeSectionSchemaData,
  ThemeSectionSettings,
  ThemeSettingFieldSchema,
  ThemeSettings,
  ThemeSettingsBlock,
  ThemeSettingSectionSchema,
} from 'types/swell';

import type { SwellTheme } from '../theme';
import type {
  CompiledComponentConfigBase,
  ExternalReference,
  ExternalSchemaProp,
} from '@swell/easyblocks-core';

export async function getAllSections(
  theme: SwellTheme,
  themeConfigs: SwellThemeConfig[],
): Promise<ThemeSectionSchema[]> {
  const allSections: ThemeSectionSchema[] = [];

  for (const config of themeConfigs) {
    if (filterSectionConfig(config, themeConfigs)) {
      const schema = await renderTemplateSchema(theme, config);

      if (schema) {
        allSections.push({
          ...schema,
          id: String(config.name || '')
            .split('.')
            .pop() as string,
        });
      }
    }
  }

  return allSections;
}

export async function getPageSections(
  theme: SwellTheme,
  sectionGroup: ThemeSectionGroup,
  getSectionSchemaHandler: (
    theme: SwellTheme,
    sectionName: string,
  ) => Promise<ThemeSectionSchemaData | undefined> = getSectionSchema,
): Promise<ThemeSectionConfig[]> {
  const order = Array.isArray(sectionGroup.order)
    ? sectionGroup.order
    : Object.keys(sectionGroup.sections || {});

  const pageSections: ThemeSectionConfig[] = [];

  for (const key of order) {
    const section: ThemeSection = sectionGroup.sections[key];

    const schemaData = await getSectionSchemaHandler(theme, section.type);

    if (!schemaData) {
      continue;
    }

    const schema: ThemeSectionSchema = { ...schemaData, id: key };

    const id = sectionGroup.id ? `page__${sectionGroup.id}__${key}` : schema.id;

    const blockOrder = Array.isArray(section.block_order)
      ? section.block_order
      : Object.keys(section.blocks || {});

    const blocks: ThemeSettingsBlock[] = blockOrder
      .map((key) => section.blocks?.[key])
      .filter(Boolean) as ThemeSettingsBlock[];

    const settings: ThemeSectionSettings = {
      section: {
        id,
        ...section,
        blocks,
      },
    };

    pageSections.push({
      id: id,
      settings: settings,
      section: { id, ...section },
      tag: schema.tag || 'div',
      class: schema.class,
      schema,
    });
  }

  return pageSections;
}

export async function getLayoutSectionGroups(
  theme: SwellTheme,
  themeConfigs: SwellThemeConfig[],
): Promise<ThemeLayoutSectionGroupConfig[]> {
  const layoutSectionGroupConfigs = themeConfigs.filter((config) =>
    filterAllLayoutSectionGroupConfigs(config, themeConfigs),
  );

  const getSectionSchema = async (
    theme: SwellTheme,
    type: string,
  ): Promise<ThemeSectionSchema | undefined> => {
    const config = themeConfigs.find((config) =>
      filterLayoutSectionGroupConfig(config, themeConfigs, type),
    );

    const schema = await renderTemplateSchema(
      theme,
      config as SwellThemeConfig,
    );

    if (!schema) {
      return undefined;
    }

    return {
      ...schema,
      id: String(config?.name || '')
        .split('.')
        .pop() as string,
    };
  };

  const layoutSectionGroups: ThemeLayoutSectionGroupConfig[] = [];
  for (const config of layoutSectionGroupConfigs) {
    let sectionGroup;
    try {
      sectionGroup = JSON5.parse<ThemeSectionGroup>(config.file_data);

      if (theme.shopifyCompatibility) {
        sectionGroup = theme.shopifyCompatibility.getSectionGroup(
          sectionGroup as ShopifySectionGroup,
        );
      }
    } catch (err) {
      // noop
      console.warn(err);
    }

    // Must have a type property
    if (sectionGroup?.type) {
      const sectionConfigs = await getPageSections(
        theme,
        sectionGroup,
        getSectionSchema,
      );

      layoutSectionGroups.push({
        ...sectionGroup,
        id: String(config.name || '')
          .split('.')
          .pop(),
        sectionConfigs,
      } as ThemeLayoutSectionGroupConfig);
    }
  }

  return layoutSectionGroups;
}

async function getSectionSchema(
  theme: SwellTheme,
  sectionName: string,
): Promise<ThemeSectionSchemaData | undefined> {
  const config = await theme.getThemeTemplateConfigByType(
    'sections',
    sectionName,
  );

  return renderTemplateSchema(theme, config as SwellThemeConfig);
}

async function renderTemplateSchema(
  theme: SwellTheme,
  config: SwellThemeConfig,
): Promise<ThemeSectionSchemaData | undefined> {
  let schema: ThemeSectionSchemaData | undefined;

  if (config?.file_path?.endsWith('.liquid')) {
    if (theme.shopifyCompatibility) {
      // Extract {% schema %} from liquid files for Shopify compatibility
      theme.liquidSwell.lastSchema = undefined;

      await theme.renderTemplate(config);

      const lastSchema = theme.liquidSwell.lastSchema;

      if (lastSchema) {
        schema = theme.shopifyCompatibility.getSectionConfigSchema(
          lastSchema as ShopifySectionSchema,
        );
      }
    }
  } else if (config?.file_data) {
    try {
      schema =
        JSON5.parse<ThemeSectionSchemaData | undefined>(config?.file_data) ||
        undefined;

      if (theme.shopifyCompatibility) {
        schema = theme.shopifyCompatibility.getSectionConfigSchema(
          schema as unknown as ShopifySectionSchema,
        );
      }
    } catch (err) {
      // noop
      console.warn(err);
    }
  }

  return schema;
}

function filterSectionConfig(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
): boolean {
  if (!config.file_path.startsWith('theme/sections/')) {
    return false;
  }

  return isJsonOrLiquidConfig(config, themeConfigs);
}

function filterAllLayoutSectionGroupConfigs(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
): boolean {
  if (
    !config.file_path.startsWith('theme/sections/') ||
    !config.file_path.endsWith('.json')
  ) {
    return false;
  }

  const targetFilePath = config.file_path.replace(/\.json$/, '.liquid');

  return !themeConfigs.some((c) => c.file_path === targetFilePath);
}

function filterLayoutSectionGroupConfig(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
  type: string,
): boolean {
  if (
    !config.file_path.endsWith(`/${type}.json`) &&
    !config.file_path.endsWith(`/${type}.liquid`)
  ) {
    return false;
  }

  return isJsonOrLiquidConfig(config, themeConfigs);
}

function isJsonOrLiquidConfig(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
): boolean {
  if (config.file_path.endsWith('.liquid')) {
    const targetFilePath = config.file_path.replace(/\.liquid$/, '.json');

    const hasJsonFile = themeConfigs.find(
      (c) => c.file_path === targetFilePath,
    );

    if (!hasJsonFile) {
      return true;
    }
  } else if (config.file_path.endsWith('.json')) {
    return true;
  }

  return false;
}

type EasyblocksFieldProps = Omit<ExternalSchemaProp, 'prop' | 'label'>;

export function schemaToEasyblocksProps(
  field: ThemeSettingFieldSchema,
): EasyblocksFieldProps {
  const sharedProps: Omit<EasyblocksFieldProps, 'type'> = {
    description: field.description,
    defaultValue: field.default as ExternalReference,
    isLabelHidden: true,
    layout: 'column',
    params: field as unknown as Record<string, unknown>,
  };

  let typeProps;
  switch (field?.type) {
    case 'text':
    case 'short_text':
      typeProps = {
        type: 'swell_short_text',
      };
      break;

    case 'paragraph':
      typeProps = {
        type: 'swell_paragraph',
      };
      break;

    case 'textarea':
    case 'long_text':
    case 'liquid':
      typeProps = {
        type: 'swell_long_text',
      };
      break;

    case 'basic_html':
    case 'rich_text':
    case 'rich_html':
    case 'markdown':
      typeProps = {
        type: 'swell_editor',
      };
      break;

    case 'number':
      typeProps = {
        type: 'swell_number',
      };
      break;

    case 'select':
      typeProps = {
        type: 'swell_select',
      };
      break;

    case 'radio':
      typeProps = {
        type: 'swell_radio',
      };
      break;

    case 'checkbox':
      typeProps = {
        type: 'swell_boolean',
      };
      break;

    case 'color':
      typeProps = {
        type: 'swell_color',
      };
      break;

    case 'color_scheme':
      typeProps = {
        type: 'swell_color_scheme',
      };
      break;

    case 'color_scheme_group':
      typeProps = {
        type: 'swell_color_scheme_group',
      };
      break;

    case 'font':
      typeProps = {
        type: 'swell_font',
      };
      break;

    case 'header':
      typeProps = {
        type: 'swell_header',
      };
      break;

    case 'icon':
      typeProps = {
        type: 'swell_menu',
      };
      break;

    case 'menu':
      typeProps = {
        type: 'swell_menu',
      };
      break;

    case 'url':
      typeProps = {
        type: 'swell_url',
      };
      break;

    case 'lookup':
    case 'generic_lookup':
    case 'product_lookup':
    case 'category_lookup':
    case 'customer_lookup':
      typeProps = {
        type: 'swell_lookup',
      };
      break;

    case 'image':
      typeProps = {
        type: 'swell_image',
        defaultValue: null,
      };
      break;

    case 'asset':
    case 'document':
    case 'video':
      typeProps = {
        type: 'swell_file',
      };
      break;

    default:
      typeProps = {
        type: 'swell_short_text',
      };
      break;
  }

  return {
    ...sharedProps,
    ...typeProps,
  } as EasyblocksFieldProps;
}

export function schemaToEasyblocksValue(
  fields: ThemeSettingFieldSchema[] | undefined,
  fieldId: string,
  value: unknown,
) {
  if (value === undefined) {
    return null;
  }

  const field = fields?.find((field) => field.id === fieldId);

  switch (field?.type) {
    // These are needed for external type values
    /* case 'color':
      return {
        id: value,
        widgetId: 'SwellColor',
      };

    case 'lookup':
    case 'product_lookup':
    case 'category_lookup':
    case 'customer_lookup':
      return {
        id: value,
        widgetId: 'SwellLookup',
      };

    case 'menu':
      return {
        id: value,
        widgetId: 'SwellMenu',
      }; */

    default:
      return value;
  }
}

export function getThemeSettingsFromProps(
  props: Record<string, unknown>,
  editorSchema: ThemeSettingSectionSchema[],
): ThemeSettings | undefined {
  return editorSchema?.reduce<ThemeSettings>((acc, settingGroup) => {
    for (const field of settingGroup.fields || []) {
      if (field?.id) {
        acc[field.id] = props[field.id];
      }
    }

    return acc;
  }, {});
}

type ReactEasyblocksCompiledComponent = React.ReactElement<{
  compiled: CompiledComponentConfigBase;
}>;

interface PageSectionComponentProps {
  Blocks?: ReactEasyblocksCompiledComponent[];
  $locale?: SwellLocaleProp;
  [key: string]: unknown;
}

export function getSectionSettingsFromProps(
  props: PageSectionComponentProps,
  sectionSchema?: ThemeSectionSchema,
): ThemeSectionBase | undefined {
  if (!sectionSchema) {
    return;
  }

  return {
    settings: sectionSchema.fields.reduce<ThemeSettings>(
      (acc, field) => {
        if (field?.id) {
          acc[field.id] = props[field.id];
        }
        return acc;
      },
      {
        $locale: props.$locale,
      },
    ),
    id: sectionSchema.id,
    blocks: props.Blocks?.filter((propBlock) =>
      Boolean(propBlock.props.compiled?._component),
    ).map((propBlock): ThemeSettingsBlock => {
      const blockProps = propBlock.props.compiled.props;
      const blockType = propBlock.props.compiled._component.split('__')[2];
      const blockSchema = sectionSchema.blocks?.find(
        (block) => block.type === blockType,
      );

      return {
        type: blockType,
        settings:
          blockSchema?.fields?.reduce<ThemeSettings>(
            (acc, field) => {
              if (field?.id) {
                acc[field.id] = blockProps[field.id] as unknown;
              }
              return acc;
            },
            { $locale: blockProps.$locale },
          ) || {},
      };
    }),
  };
}

export function toEasyblocksFieldId(fieldId?: string): string {
  if (!fieldId) {
    return fieldId as string;
  }

  return fieldId.replace(/\./g, '·');
}

export function toSchemaFieldId(fieldId?: string): string {
  if (!fieldId) {
    return fieldId as string;
  }

  return fieldId.replace(/·/g, '.');
}
