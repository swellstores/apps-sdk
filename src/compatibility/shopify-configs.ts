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
  ThemeSectionSchema,
  ThemeSettingFieldSchema,
  ThemeSettings,
  ThemeSettingSectionSchema,
} from 'types/swell';

export function convertShopifySettingsSchema(
  settingsSchema: ShopifySettingsSchema,
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
    (editor.settings as any[]).push(
      shopifySchemaSectionToSwellSettingSection(section),
    );
  });

  return editor;
}

export function convertShopifySettingsData(
  settingsData: ShopifySettingsData,
): ThemeSettings {
  // Shopify's current settings in the first object
  return settingsData.current || {};
}

export function convertShopifySettingsPresets(
  settingsData: ShopifySettingsData,
): ThemePresetSchema[] {
  return Object.entries(settingsData.presets || {}).map(
    ([name, preset]) => ({
      label: name,
      settings: preset,
    }),
  );
}

export function convertShopifySectionSchema(
  sectionSchema: ShopifySectionSchema,
): ThemeSectionSchema {
  const schema: ThemeSectionSchema = {
    label: sectionSchema.name,
    type: sectionSchema.type,
    tag: sectionSchema.tag,
    class: sectionSchema.class,
    enabled_on: sectionSchema.enabled_on,
    disabled_on: sectionSchema.disabled_on,
    fields: (sectionSchema.settings || []).map((setting) =>
      shopifySchemaSettingToSwellSettingField(setting),
    ),
    blocks: (sectionSchema.blocks || []).map((block) =>
      shopifySchemaBlockToSwellBlockSchema(block),
    ),
    presets: (sectionSchema.presets || []).map((preset) =>
      shopifySchemaPresetToSwellPresetSchema(preset),
    ),
    default: sectionSchema.default,
  };

  return schema;
}

export function shopifySchemaBlockToSwellBlockSchema(
  block: ShopifySectionBlockSchema,
): ThemeBlockSchema {
  const schema: ThemeBlockSchema = {
    type: block.type,
    label: block.name,
    limit: block.limit,
    fields: (block.settings || []).map((setting) =>
      shopifySchemaSettingToSwellSettingField(setting),
    ),
  };

  return schema;
}

export function shopifySchemaPresetToSwellPresetSchema(
  preset: ShopifySectionPresetSchema,
): ThemePresetSchema {
  const schema: ThemePresetSchema = {
    label: preset.name,
    settings: preset.settings,
    blocks: preset.blocks,
  };

  return schema;
}

export function shopifySchemaSectionToSwellSettingSection(
  section: ShopifySettingSection,
): ThemeSettingSectionSchema {
  const swellSettingSection: ThemeSettingSectionSchema = {
    label: section.name,
    fields: (section.settings || []).map((setting) =>
      shopifySchemaSettingToSwellSettingField(setting),
    ),
  };

  return swellSettingSection;
}

export function shopifySchemaSettingToSwellSettingField(
  setting: ShopifySettingSchema,
): ThemeSettingFieldSchema {
  let swellProps: any = {};

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

    case 'select':
      swellProps = {
        type: 'select',
        options: setting.options,
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
        options: setting.options,
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
        collection: 'content/blogs:posts',
      };
      break;

    case 'blog':
      swellProps = {
        type: 'lookup',
        collection: 'content/blogs',
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
      swellProps = {
        type: 'color',
      };
      break;

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
        type: 'html',
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
        id: setting.content,
        label: setting.content,
      };
      break;
  }

  return {
    id: setting.id,
    label: setting.label,
    default: setting.default,
    description: setting.info,
    ...swellProps,
  };
}
