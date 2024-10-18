import type { ShopifySectionSchema } from 'types/shopify';

import type {
  SwellRecord,
  SwellThemeConfig,
  ThemeLayoutSectionGroupConfig,
  ThemeSection,
  ThemeSectionConfig,
  ThemeSectionGroup,
  ThemeSectionSchema,
  ThemeSectionSettings,
  ThemeSettingFieldSchema,
  ThemeSettingsBlock,
} from 'types/swell';

import type { SwellTheme } from '../theme';

export function getPageTemplate(theme: SwellTheme, pageId: string) {
  return theme.renderPageTemplate(pageId);
}

export async function getAllSections(
  theme: SwellTheme,
  themeConfigs: SwellThemeConfig[],
): Promise<ThemeSectionSchema[]> {
  const allSections = [];

  for (const config of themeConfigs) {
    if (filterSectionConfig(config, themeConfigs)) {
      const schema = await renderTemplateSchema(
        theme,
        config as SwellThemeConfig,
      );

      allSections.push({
        id: config.name.split('.').pop(),
        ...schema,
      });
    }
  }

  return allSections;
}

export async function getPageSections(
  theme: SwellTheme,
  sectionGroup: ThemeSectionGroup | SwellRecord,
  getSectionSchemaHandler: any = getSectionSchema,
): Promise<ThemeSectionConfig[]> {
  const order =
    sectionGroup.order instanceof Array
      ? sectionGroup.order
      : Object.keys(sectionGroup.sections || {});

  const pageSections = [];
  for (const key of order) {
    const section: ThemeSection = sectionGroup.sections[key];

    const schema = await getSectionSchemaHandler(theme, section.type);
    if (!schema) {
      continue;
    }

    const id = sectionGroup.id ? `page__${sectionGroup.id}__${key}` : schema.id;

    const blockOrder =
      section.block_order instanceof Array
        ? section.block_order
        : Object.keys(section.blocks || {});

    const blocks: ThemeSettingsBlock[] = blockOrder
      .map((key: string) => section.blocks?.[key])
      .filter(Boolean) as ThemeSettingsBlock[];

    const settings: ThemeSectionSettings = {
      section: {
        id,
        ...section,
        blocks,
      },
    };

    pageSections.push({
      id: id as string,
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

    return {
      ...schema,
      id: config?.name.split('.').pop(),
    };
  };

  const layoutSectionGroups = [];
  for (const config of layoutSectionGroupConfigs) {
    let sectionGroup;
    try {
      sectionGroup = JSON.parse(config.file_data);
      // Convert name to label if shopify format
      if (sectionGroup?.name) {
        sectionGroup.label = sectionGroup.name;
        delete sectionGroup.name;
      }
    } catch {
      // noop
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
        id: config.name.split('.').pop(),
        sectionConfigs,
      });
    }
  }

  return layoutSectionGroups;
}

export async function getSectionSchema(
  theme: SwellTheme,
  sectionName: string,
): Promise<ThemeSectionSchema | undefined> {
  const config = await theme.getThemeTemplateConfigByType(
    'sections',
    sectionName,
  );

  return renderTemplateSchema(theme, config as SwellThemeConfig);
}

export async function renderTemplateSchema(
  theme: SwellTheme,
  config: SwellThemeConfig,
): Promise<any> {
  let schema = {};

  if (config?.file_path?.endsWith('.liquid')) {
    if (theme.shopifyCompatibility) {
      // Extract {% schema %} from liquid files for Shopify compatibility
      theme.liquidSwell.lastSchema = undefined;

      await theme.renderTemplate(config);

      const lastSchema = (theme.liquidSwell.lastSchema ||
        {}) as ShopifySectionSchema;

      if (lastSchema) {
        schema = theme.shopifyCompatibility.getSectionConfigSchema(lastSchema);
      }
    }
  } else if (config?.file_data) {
    try {
      schema = JSON.parse(config?.file_data) || undefined;
    } catch {
      // noop
    }
  }

  return schema;
}

export function filterSectionConfig(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
) {
  if (!config.file_path.startsWith('theme/sections/')) {
    return false;
  }

  return isJsonOrLiquidConfig(config, themeConfigs);
}

export function filterAllLayoutSectionGroupConfigs(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
) {
  if (
    !config.file_path.startsWith('theme/sections/') ||
    !config.file_path.endsWith('.json')
  ) {
    return false;
  }

  const targetFilePath = config.file_path.replace(/\.json$/, '.liquid');

  return !themeConfigs.find((c) => c.file_path === targetFilePath);
}

export function filterLayoutSectionGroupConfig(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
  type: string,
) {
  if (
    !config.file_path.endsWith(`/${type}.json`) &&
    !config.file_path.endsWith(`/${type}.liquid`)
  ) {
    return false;
  }

  return isJsonOrLiquidConfig(config, themeConfigs);
}

export function isJsonOrLiquidConfig(
  config: SwellThemeConfig,
  themeConfigs: SwellThemeConfig[],
) {
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

export function schemaToEasyblocksProps(field: ThemeSettingFieldSchema) {
  const sharedProps = {
    description: field.description,
    defaultValue: field.default !== undefined ? field.default : null,
    isLabelHidden: true,
    layout: 'column',
    params: field,
  };

  let typeProps;
  switch (field?.type) {
    case 'text':
    case 'short_text':
      typeProps = {
        type: 'swell_short_text',
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
        defaultValue: '', // Easyblocks requires an empty string for image fields
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
  };
}

export function schemaToEasyblocksValue(
  fields: ThemeSettingFieldSchema[] | undefined,
  fieldId: string,
  value: any,
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

export function getThemeSettingsFromProps(props: any, editorSchema: any[]) {
  return editorSchema?.reduce((acc: any, settingGroup: any) => {
    for (const field of settingGroup.fields || []) {
      if (field?.id) {
        acc[field.id] = props[field.id];
      }
    }

    return acc;
  }, {});
}

export function getSectionSettingsFromProps(props: any, sectionSchema: any) {
  return sectionSchema
    ? {
        settings: sectionSchema.fields?.reduce((acc: any, field: any) => {
          if (field?.id) {
            acc[field.id] = props[field.id];
          }
          return acc;
        }, {}),
        id: sectionSchema.id,
        blocks: props.Blocks?.filter(
          (propBlock: any) => propBlock.props.compiled?._component,
        ).map((propBlock: any) => {
          const blockProps = propBlock.props.compiled.props;
          const blockType = propBlock.props.compiled._component.split('__')[2];
          const blockSchema = sectionSchema.blocks?.find(
            (block: any) => block.type === blockType,
          );
          return {
            type: blockType,
            settings: blockSchema?.fields?.reduce((acc: any, field: any) => {
              if (field?.id) {
                acc[field.id] = blockProps[field.id];
              }
              return acc;
            }, {}),
          };
        }),
      }
    : {};
}
