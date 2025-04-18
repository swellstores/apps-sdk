import { isObject } from '@/utils';

import type {
  ShopifySectionBlockSchema,
  ShopifySectionPresetSchema,
  ShopifySectionSchema,
  ShopifySettingSchema,
  ShopifySettingsData,
  ShopifySettingSection,
  ShopifySettingsSchema,
} from 'types/shopify';

import type {
  ThemeBlockSchema,
  ThemeEditorSchema,
  ThemePresetSchema,
  ThemeSectionSchemaData,
  ThemeSettingFieldSchema,
  ThemeSettings,
  ThemeSettingSectionSchema,
} from 'types/swell';

export function convertShopifySettingsSchema(
  settingsSchema: ShopifySettingsSchema,
  locale: string,
): ThemeEditorSchema {
  const editor: ThemeEditorSchema = {
    settings: [],
  };

  if (!Array.isArray(settingsSchema)) {
    return editor;
  }

  // Ignore theme info
  if (settingsSchema[0]?.name === 'theme_info') {
    settingsSchema.shift();
  }

  settingsSchema.forEach((section: ShopifySettingSection) => {
    editor.settings?.push(
      shopifySchemaSectionToSwellSettingSection(section, locale),
    );
  });

  return editor;
}

export function convertShopifySettingsData(
  settingsData: ShopifySettingsData,
): ThemeSettings {
  // Current may refer to a preset
  if (
    typeof settingsData.current === 'string' &&
    settingsData.presets?.[settingsData.current]
  ) {
    return settingsData.presets[settingsData.current];
  }

  if (typeof settingsData.current === 'object') {
    // Shopify's current settings in the first object
    return settingsData.current || {};
  }

  return {};
}

export function convertShopifySettingsPresets(
  settingsData: ShopifySettingsData,
): ThemePresetSchema[] {
  return Object.entries(settingsData.presets || {}).map(([name, preset]) => ({
    label: name,
    settings: preset,
  }));
}

export function convertShopifySectionSchema(
  sectionSchema: ShopifySectionSchema,
  locale: string = 'en',
): ThemeSectionSchemaData {
  const schema: ThemeSectionSchemaData = {
    label: getLocalizedValue(sectionSchema.name, locale),
    type: sectionSchema.type,
    tag: sectionSchema.tag,
    class: sectionSchema.class,
    limit: sectionSchema.limit,
    enabled_on: sectionSchema.enabled_on,
    disabled_on: sectionSchema.disabled_on,
    fields: (sectionSchema.settings || []).map((setting) =>
      shopifySchemaSettingToSwellSettingField(setting, locale),
    ),
    blocks: (sectionSchema.blocks || []).map((block) =>
      shopifySchemaBlockToSwellBlockSchema(block, locale),
    ),
    presets: (sectionSchema.presets || []).map((preset) =>
      shopifySchemaPresetToSwellPresetSchema(preset, locale),
    ),
    default: sectionSchema.default
      ? shopifySchemaPresetToSwellPresetSchema(sectionSchema.default, locale)
      : undefined,
  };

  return schema;
}

function shopifySchemaBlockToSwellBlockSchema(
  block: ShopifySectionBlockSchema,
  locale: string,
): ThemeBlockSchema {
  const schema: ThemeBlockSchema = {
    type: block.type,
    label: getLocalizedValue(block.name, locale),
    limit: block.limit,
    fields: (block.settings || []).map((setting) =>
      shopifySchemaSettingToSwellSettingField(setting, locale),
    ),
  };

  return schema;
}

function shopifySchemaPresetToSwellPresetSchema(
  preset: ShopifySectionPresetSchema,
  locale: string,
): ThemePresetSchema {
  const schema: ThemePresetSchema = {
    label: getLocalizedValue(preset.name, locale),
    settings: preset.settings,
    blocks: preset.blocks,
  };

  return schema;
}

function shopifySchemaSectionToSwellSettingSection(
  section: ShopifySettingSection,
  locale: string,
): ThemeSettingSectionSchema {
  const swellSettingSection: ThemeSettingSectionSchema = {
    label: getLocalizedValue(section.name, locale),
    fields: (section.settings || []).map((setting) =>
      shopifySchemaSettingToSwellSettingField(setting, locale),
    ),
  };

  return swellSettingSection;
}

function shopifySchemaSettingToSwellSettingField(
  setting: ShopifySettingSchema,
  locale: string,
): ThemeSettingFieldSchema {
  let swellProps: Partial<ThemeSettingFieldSchema> = {};

  switch (setting.type) {
    case 'text':
      swellProps = {
        type: 'text',
      };
      break;

    case 'textarea':
      swellProps = {
        type: 'textarea',
      };
      break;

    case 'paragraph':
      swellProps = {
        type: 'paragraph',
        label: setting.content
          ? getLocalizedValue(setting.content, locale)
          : undefined,
      };
      break;

    case 'select':
      swellProps = {
        type: 'select',
        options: setting.options?.map((option) => ({
          label: getLocalizedValue(option.label, locale),
          value: option.value,
        })),
      };
      break;

    case 'checkbox':
      swellProps = {
        type: 'checkbox',
      };
      break;

    case 'radio':
      swellProps = {
        type: 'radio',
        options: setting.options?.map((option) => ({
          label: getLocalizedValue(option.label, locale),
          value: option.value,
        })),
      };
      break;

    case 'number':
      swellProps = {
        type: 'integer',
      };
      break;

    case 'range':
      swellProps = {
        type: 'number',
        min: setting.min,
        max: setting.max,
        increment: setting.step,
        unit: setting.unit,
      };
      break;

    case 'article':
      swellProps = {
        type: 'lookup',
        collection: 'content/blogs',
        titleField: 'title',
      };
      break;

    case 'blog':
      swellProps = {
        type: 'lookup',
        collection: 'content/blogs',
        titleField: 'title',
      };
      break;

    case 'collection':
      swellProps = {
        type: 'category_lookup',
      };
      break;

    case 'collection_list':
      swellProps = {
        type: 'category_lookup',
        multiple: true,
        limit: setting.limit,
      };
      break;

    case 'color':
    case 'color_background':
      swellProps = {
        type: 'color',
      };
      break;

    case 'color_scheme':
      swellProps = {
        type: 'color_scheme',
      };
      break;

    case 'color_scheme_group':
      swellProps = {
        type: 'color_scheme_group',
        fields: (setting.definition || []).map((setting) =>
          shopifySchemaSettingToSwellSettingField(
            setting as ShopifySettingSchema,
            locale,
          ),
        ),
        role: setting.role,
      };
      break;

    case 'font_picker':
      swellProps = {
        type: 'font',
      };
      break;

    case 'html':
      swellProps = {
        type: 'basic_html',
      };
      break;

    case 'image_picker':
      swellProps = {
        type: 'image',
      };
      break;

    case 'inline_richtext':
      swellProps = {
        type: 'rich_text',
      };
      break;

    case 'link_list':
      swellProps = {
        type: 'menu',
      };
      break;

    case 'liquid':
      swellProps = {
        type: 'liquid',
      };
      break;

    case 'page':
      swellProps = {
        type: 'lookup',
        collection: 'content/pages',
        titleField: 'title',
      };
      break;

    case 'product':
      swellProps = {
        type: 'product_lookup',
      };
      break;

    case 'product_list':
      swellProps = {
        type: 'product_lookup',
        multiple: true,
        limit: setting.limit,
      };
      break;

    case 'richtext':
      swellProps = {
        type: 'rich_html',
      };
      break;

    case 'text_alignment':
      swellProps = {
        type: 'select',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
      };
      break;

    case 'url':
      swellProps = {
        type: 'url',
      };
      break;

    case 'video':
      swellProps = {
        type: 'video',
      };
      break;

    case 'video_url':
      swellProps = {
        type: 'url',
      };
      break;

    case 'header':
      swellProps = {
        type: 'header',
        label: setting.content
          ? getLocalizedValue(setting.content, locale)
          : undefined,
      };
      break;

    default:
      break;
  }

  return {
    ...setting, // Include swell-specific properties
    id: setting.id,
    label: getLocalizedValue(setting.label, locale),
    default:
      typeof setting.default !== 'undefined'
        ? getLocalizedValue(setting.default, locale)
        : undefined,
    description: setting.info
      ? getLocalizedValue(setting.info, locale)
      : undefined,
    ...swellProps,
  } as ThemeSettingFieldSchema;
}

function getLocalizedValue(
  value: string | Record<string, string | undefined>,
  locale: string,
): string {
  if (isObject(value)) {
    const localized = value[locale];

    if (localized) {
      return localized;
    }

    const shortLocale = locale.slice(0, 2);

    return value[shortLocale] as string;
  }

  return value;
}
