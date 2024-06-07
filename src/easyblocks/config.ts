export async function getEasyblocksPropsFromThemeConfigs(
  theme: SwellTheme,
  themeConfigs: SwellCollection,
  pageId: string,
) {
  const pageTemplate = await getPageTemplate(theme, pageId);
  const allSections = await getAllSections(theme, themeConfigs);
  const pageSections = await getPageSections(
    theme,
    pageTemplate as ThemeSectionGroup,
  );
  const layoutSectionGroups = await getLayoutSectionGroups(theme, themeConfigs);

  return {
    pageTemplate,
    allSections,
    pageSections,
    layoutSectionGroups,
  };
}

export async function getPageTemplate(theme: SwellTheme, pageId: string) {
  return await theme.renderPageTemplate(pageId);
}

export async function getAllSections(
  theme: SwellTheme,
  themeConfigs: SwellCollection,
): Promise<ThemeSectionSchema[]> {
  if (!themeConfigs?.results) return [];

  return await Promise.all(
    themeConfigs.results
      .filter((config) => filterSectionConfig(config, themeConfigs))
      .map(async (config: SwellRecord) => {
        const schema = await renderTemplateSchema(
          theme,
          config as SwellThemeConfig,
        );
        return {
          ...schema,
          id: config.name.split('.').pop(),
        };
      }),
  );
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

  const sections = (
    await Promise.all(
      order.map((key: string): Promise<ThemeSectionConfig | void> => {
        return new Promise(async (resolve) => {
          const section: ThemeSection = sectionGroup.sections[key];

          const schema = await getSectionSchemaHandler(theme, section.type);
          if (!schema) {
            return resolve();
          }

          const id = sectionGroup.id
            ? `page__${sectionGroup.id}__${key}`
            : schema.id;

          const blockOrder =
            section.block_order instanceof Array
              ? section.block_order
              : Object.keys(section.blocks || {});

          const blocks: ThemeSettingsBlock[] = (
            await Promise.all(
              blockOrder.map((key: string) => section.blocks?.[key]),
            )
          ).filter(Boolean) as ThemeSettingsBlock[];

          const settings = {
            section: {
              id,
              ...section,
              blocks,
            },
          };

          resolve({
            id: id as string,
            settings: settings as ThemeSectionSettings,
            section: { id, ...section },
            tag: schema.tag || 'div',
            class: schema.class,
            schema,
          });
        });
      }),
    )
  ).filter(Boolean) as ThemeSectionConfig[];

  return sections;
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

  return await Promise.all(
    layoutSectionGroupConfigs.map(
      (config: SwellRecord): Promise<ThemeLayoutSectionGroupConfig> => {
        return new Promise(async (resolve: any) => {
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
            resolve({
              ...sectionGroup,
              id: config.name.split('.').pop(),
              sectionConfigs,
            });
          } else {
            resolve();
          }
        });
      },
    ),
  ).then((result: any[]) => result.filter(Boolean));
}

async function getSectionSchema(
  theme: SwellTheme,
  sectionName: string,
): Promise<ThemeSectionSchema | undefined> {
  const config = await theme.getThemeTemplateConfigByType(
    'sections',
    sectionName,
  );

  return renderTemplateSchema(theme, config as SwellThemeConfig);
}

async function renderTemplateSchema(
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
