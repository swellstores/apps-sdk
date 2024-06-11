export async function getPageTemplate(theme: SwellTheme, pageId: string) {
  return await theme.renderPageTemplate(pageId);
}

export async function getAllSections(
  theme: SwellTheme,
  themeConfigs: SwellCollection,
): Promise<ThemeSectionSchema[]> {
  if (!themeConfigs?.results) return [];

  const sectionConfigs = themeConfigs.results.filter((config) =>
    filterSectionConfig(config, themeConfigs),
  );

  const allSections = [];
  for (const config of sectionConfigs) {
    const schema = await renderTemplateSchema(
      theme,
      config as SwellThemeConfig,
    );
    allSections.push({
      id: config.name.split('.').pop(),
      ...schema,
    });
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

    const settings = {
      section: {
        id,
        ...section,
        blocks,
      },
    };

    pageSections.push({
      id: id as string,
      settings: settings as ThemeSectionSettings,
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
  themeConfigs: SwellCollection,
): Promise<ThemeLayoutSectionGroupConfig[]> {
  if (!themeConfigs?.results) return [];

  const layoutSectionGroupConfigs = themeConfigs.results.filter((config) =>
    filterAllLayoutSectionGroupConfigs(config, themeConfigs),
  );

  const getSectionSchema = async (
    theme: SwellTheme,
    type: string,
  ): Promise<ThemeSectionSchema | undefined> => {
    const config = themeConfigs.results.find((config) =>
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

      const lastSchema = theme.liquidSwell.lastSchema || {};

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
  config: SwellRecord,
  themeConfigs: SwellCollection,
) {
  if (!config.file_path?.startsWith('theme/sections/')) return false;

  return isJsonOrLiquidConfig(config, themeConfigs);
}

export function filterAllLayoutSectionGroupConfigs(
  config: SwellRecord,
  themeConfigs: SwellCollection,
) {
  return (
    config.file_path?.startsWith('theme/sections/') &&
    config.file_path?.endsWith('.json') &&
    // Section groups must not have a liquid file
    !themeConfigs.results.find(
      (c: SwellRecord) =>
        c.file_path === config.file_path.replace(/\.json$/, '.liquid'),
    )
  );
}

export function filterLayoutSectionGroupConfig(
  config: SwellRecord,
  themeConfigs: SwellCollection,
  type: string,
) {
  if (
    !config.file_path?.endsWith(`/${type}.json`) &&
    !config.file_path?.endsWith(`/${type}.liquid`)
  ) {
    return false;
  }

  return isJsonOrLiquidConfig(config, themeConfigs);
}

export function isJsonOrLiquidConfig(
  config: SwellRecord,
  themeConfigs: SwellCollection,
) {
  const isLiquidFile = config.file_path.endsWith('.liquid');
  const isJsonFile = config.file_path.endsWith('.json');

  if (isLiquidFile) {
    const hasJsonFile = themeConfigs.results.find(
      (c: any) =>
        c.file_path === config.file_path.replace(/\.liquid$/, '.json'),
    );
    if (!hasJsonFile) {
      return true;
    }
  } else if (isJsonFile) {
    return true;
  }

  return false;
}

export function schemaToEasyblocksProps(field: ThemeSettingFieldSchema) {
  const sharedProps = {
    description: field.description,
    isLabelHidden: true,
    layout: 'column',
  };

  let typeProps;
  switch (field?.type) {
    case 'text':
    case 'short_text':
      typeProps = {
        type: 'short_text',
      };
      break;
    case 'textarea':
    case 'long_text':
      typeProps = {
        type: 'long_text',
      };
      break;

    case 'basic_html':
    case 'rich_text':
    case 'rich_html':
    case 'markdown':
    case 'liquid':
      typeProps = {
        type: 'editor',
      };
      break;

    case 'number':
      typeProps = {
        type: 'number',
        params: {
          min: field.min,
          max: field.max,
          unit: field.unit,
          increment: field.increment,
        },
      };
      break;

    case 'select':
      typeProps = {
        type: 'select',
        params: {
          options: field.options?.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      };
      break;

    case 'radio':
      typeProps = {
        type: 'radio-group',
        params: {
          options: field.options?.map((option) => ({
            label: option.label,
            value: option.value,
          })),
        },
      };
      break;

    case 'checkbox':
      typeProps = {
        type: 'boolean',
        defaultValue: field.default,
      };
      break;

    case 'color':
      typeProps = {
        type: 'color',
      };
      break;

    // TODO: custom types
    case 'menu':
      typeProps = {
        type: 'menu', // only testing
      };
      break;
    case 'lookup':
    case 'generic_lookup':
    case 'product_lookup':
    case 'category_lookup':
    case 'customer_lookup':
      typeProps = {
        type: 'menu', // only testing
      };
      break;
    case 'image':
    case 'document':
    case 'video':
    case 'color_scheme':
    case 'color_scheme_group':
    default:
      typeProps = {
        type: 'file',
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
  const field = fields?.find((field) => field.id === fieldId);
  switch (field?.type) {
    // Note this should work for type "text" but it doesn't
    /* case "text":
    // Note these need a different component:
    case "textarea":
      return {
        id: Math.random().toString(),
        value: {
          ['en-US']: value || "",
        },
        widgetId: "@easyblocks/local-text"
      } */
    default:
      return value;
  }
}
