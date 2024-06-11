import { Swell } from '../api';
import { themeConfigQuery } from '../utils';

export async function getThemeConfig(
  swell: Swell,
  themePath: string,
): Promise<SwellRecord | null> {
  if (!swell.swellHeaders['theme-id']) {
    return null;
  }

  const config = await swell.getCached(
    'editor-theme-config',
    [themePath],
    async () => {
      return await swell.get('/:themes:configs/:last', {
        ...themeConfigQuery(swell.swellHeaders),
        file_path: `theme/${themePath}.json`,
        fields: 'type, name, file, file_path, file_data',
        include: {
          file_data: {
            url: '/:themes:configs/{id}/file/data',
            conditions: {
              type: 'theme',
            },
          },
        },
      });
    },
  );

  try {
    return JSON.parse(config.file_data);
  } catch {
    return null;
  }
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
