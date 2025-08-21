import { Swell } from '@/api';
import { SwellTheme } from '@/theme';
import { ShopifyCompatibility } from '@/compatibility/shopify';

import { setStorefrontLocalization } from '@/liquid/test-helpers';

import {
  getAllSections,
  getPageSections,
  getLayoutSectionGroups,
  schemaToEasyblocksProps,
  schemaToEasyblocksValue,
} from './utils';

import type {
  SwellFile,
  SwellThemeConfig,
  ThemeSectionGroup,
  ThemeSettingFieldSchema,
} from 'types/swell';

describe('easyblocks/utils', () => {
  describe('getAllSections', () => {
    it('returns all section schemas', async () => {
      const swell = new Swell({
        url: 'http://localhost',
        headers: {},
        swellHeaders: {
          'store-id': 'test',
          'public-key': 'publickey',
        },
      });

      setStorefrontLocalization(swell, 'en-US', 'USD');

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const swellThemeConfigs: SwellThemeConfig[] = [
        {
          id: 'test_1',
          name: 'test_1',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/test_1.liquid',
          file_data:
            '{% schema %}{ "name": "Test section", "tag": "section", "class": "section" }{% endschema %}',
        },
        {
          id: 'test_2',
          name: 'test_2',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/test_2.json',
          file_data:
            '{ "name": "Test section 2", "tag": "section", "class": "section" }',
        },
        // Json config should be preferred over liquid
        {
          id: 'test_3',
          name: 'test_3',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/test_3.liquid',
          file_data:
            '{% schema %}{ "name": "Test section 3", "tag": "section", "class": "section" }{% endschema %}',
        },
        {
          id: 'test_4',
          name: 'test_4',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/test_3.json',
          file_data:
            '{ "name": "Test section 3", "tag": "section", "class": "section" }',
        },
        // Other configs (not "theme/sections/") should be ignored
        {
          id: 'test_5',
          name: 'test_5',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/templates/test_5.json',
          file_data:
            '{ "name": "Test section 5", "tag": "section", "class": "section" }',
        },
        // liquid without schema should be ignored
        {
          id: 'test_6',
          name: 'test_6',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/test_6.liquid',
          file_data: '<div>test section</div>',
        },
      ];

      const sections = await getAllSections(theme, swellThemeConfigs);

      expect(sections).toEqual([
        {
          label: 'Test section',
          type: undefined,
          tag: 'section',
          class: 'section',
          enabled_on: undefined,
          disabled_on: undefined,
          fields: [],
          blocks: [],
          presets: [],
          default: undefined,
          id: 'test_1',
        },
        {
          label: 'Test section 2',
          tag: 'section',
          class: 'section',
          id: 'test_2',
          enabled_on: undefined,
          disabled_on: undefined,
          fields: [],
          blocks: [],
          presets: [],
          default: undefined,
        },
        {
          label: 'Test section 3',
          tag: 'section',
          class: 'section',
          id: 'test_4',
          enabled_on: undefined,
          disabled_on: undefined,
          fields: [],
          blocks: [],
          presets: [],
          default: undefined,
        },
      ]);
    });

    it('should ignore liquid when there is no shopify compatibility', async () => {
      const swell = new Swell({
        url: 'http://localhost',
        headers: {},
        swellHeaders: {
          'store-id': 'test',
          'public-key': 'publickey',
        },
      });

      const theme = new SwellTheme(swell);

      const swellThemeConfigs: SwellThemeConfig[] = [
        {
          id: 'test_1',
          name: 'test_1',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/test_1.liquid',
          file_data:
            '{% schema %}{ "name": "Test section", "tag": "section", "class": "section" }{% endschema %}',
        },
        {
          id: 'test_2',
          name: 'test_2',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/test_2.json',
          file_data:
            '{ "name": "Test section 2", "tag": "section", "class": "section" }',
        },
      ];

      const sections = await getAllSections(theme, swellThemeConfigs);

      expect(sections).toEqual([
        {
          name: 'Test section 2',
          tag: 'section',
          class: 'section',
          id: 'test_2',
        },
      ]);
    });
  });

  describe('getPageSections', () => {
    it('should get the page sections', async () => {
      const swell = new Swell({
        url: 'http://localhost',
        headers: {},
        swellHeaders: {
          'store-id': 'test',
          'public-key': 'publickey',
          'theme-id': 'test_theme_id',
        },
      });

      setStorefrontLocalization(swell, 'en-US', 'USD');

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const swellThemeConfigs: SwellThemeConfig[] = [
        {
          id: 'section_1',
          name: 'section_1',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/section_1.liquid',
          file_data:
            '{% schema %}{ "name": "Test section", "tag": "section", "class": "section" }{% endschema %}',
        },
        {
          id: 'section_2',
          name: 'section_2',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/section_2.json',
          file_data:
            '{ "name": "Test section 2", "tag": "section", "class": "section" }',
        },
      ];

      theme.themeConfigs = swellThemeConfigs.reduce((map, config) => {
        return map.set(config.file_path, config);
      }, new Map());

      const sectionGroup: ThemeSectionGroup = {
        id: 'test_section_group_id',
        sections: {
          section_1: {
            type: 'section_1',
            settings: { key_1: 'value_1' },
            blocks: {
              block_1: {
                type: 'block_1',
                settings: { block_1_key_1: 'block_1_value_1' },
              },
              block_2: {
                type: 'block_2',
                settings: { block_2_key_1: 'block_2_value_1' },
              },
            },
            block_order: ['block_2', 'block_1'],
          },
          section_2: {
            type: 'section_2',
            settings: { key_2: 'value_2' },
            blocks: {
              block_3: {
                type: 'block_3',
                settings: { block_3_key_1: 'block_3_value_1' },
              },
              block_4: {
                type: 'block_4',
                settings: { block_4_key_1: 'block_4_value_1' },
              },
            },
          },
        },
        order: ['section_2', 'section_1'],
      };

      const sections = await getPageSections(theme, sectionGroup);

      expect(sections).toEqual([
        {
          id: 'page__test_section_group_id__section_2',
          settings: {
            section: {
              id: 'page__test_section_group_id__section_2',
              type: 'section_2',
              settings: { key_2: 'value_2' },
              blocks: [
                {
                  type: 'block_3',
                  settings: { block_3_key_1: 'block_3_value_1' },
                },
                {
                  type: 'block_4',
                  settings: { block_4_key_1: 'block_4_value_1' },
                },
              ],
              location: 'custom.section_2',
              index0: 0,
              index: 1,
            },
          },
          section: {
            id: 'page__test_section_group_id__section_2',
            type: 'section_2',
            settings: { key_2: 'value_2' },
            blocks: {
              block_3: {
                type: 'block_3',
                settings: { block_3_key_1: 'block_3_value_1' },
              },
              block_4: {
                type: 'block_4',
                settings: { block_4_key_1: 'block_4_value_1' },
              },
            },
          },
          tag: 'section',
          class: 'section',
          schema: {
            label: 'Test section 2',
            tag: 'section',
            class: 'section',
            id: 'section_2',
            enabled_on: undefined,
            disabled_on: undefined,
            fields: [],
            blocks: [],
            presets: [],
            default: undefined,
          },
        },
        {
          id: 'page__test_section_group_id__section_1',
          settings: {
            section: {
              id: 'page__test_section_group_id__section_1',
              type: 'section_1',
              settings: { key_1: 'value_1' },
              blocks: [
                {
                  type: 'block_2',
                  settings: { block_2_key_1: 'block_2_value_1' },
                },
                {
                  type: 'block_1',
                  settings: { block_1_key_1: 'block_1_value_1' },
                },
              ],
              block_order: ['block_2', 'block_1'],
              location: 'custom.section_1',
              index0: 1,
              index: 2,
            },
          },
          section: {
            id: 'page__test_section_group_id__section_1',
            type: 'section_1',
            settings: { key_1: 'value_1' },
            blocks: {
              block_1: {
                type: 'block_1',
                settings: { block_1_key_1: 'block_1_value_1' },
              },
              block_2: {
                type: 'block_2',
                settings: { block_2_key_1: 'block_2_value_1' },
              },
            },
            block_order: ['block_2', 'block_1'],
          },
          tag: 'section',
          class: 'section',
          schema: {
            label: 'Test section',
            tag: 'section',
            class: 'section',
            id: 'section_1',
            enabled_on: undefined,
            disabled_on: undefined,
            fields: [],
            blocks: [],
            presets: [],
            default: undefined,
          },
        },
      ]);
    });

    it('should fill in id when section group does not contain it', async () => {
      const swell = new Swell({
        url: 'http://localhost',
        headers: {},
        swellHeaders: {
          'store-id': 'test',
          'public-key': 'publickey',
          'theme-id': 'test_theme_id',
        },
      });

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const swellThemeConfigs: SwellThemeConfig[] = [
        {
          id: 'section_test',
          name: 'section_test',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/section_test.json',
          file_data:
            '{ "name": "Test section 2", "tag": "section", "class": "section" }',
        },
      ];

      theme.themeConfigs = swellThemeConfigs.reduce((map, config) => {
        return map.set(config.file_path, config);
      }, new Map());

      const sectionGroup: ThemeSectionGroup = {
        sections: {
          section_test: {
            type: 'section_test',
            settings: {},
            blocks: {},
          },
        },
      };

      const sections = await getPageSections(theme, sectionGroup);

      expect(sections).toEqual([
        {
          id: 'section_test',
          settings: {
            section: {
              id: 'section_test',
              type: 'section_test',
              settings: {},
              blocks: [],
              location: 'custom.section_test',
              index0: 0,
              index: 1,
            },
          },
          section: {
            id: 'section_test',
            type: 'section_test',
            settings: {},
            blocks: {},
          },
          tag: 'section',
          class: 'section',
          schema: {
            label: 'Test section 2',
            tag: 'section',
            class: 'section',
            id: 'section_test',
            enabled_on: undefined,
            disabled_on: undefined,
            fields: [],
            blocks: [],
            presets: [],
            default: undefined,
          },
        },
      ]);
    });
  });

  describe('getLayoutSectionGroups', () => {
    it('should return layout section groups', async () => {
      const swell = new Swell({
        url: 'http://localhost',
        headers: {},
        swellHeaders: {
          'store-id': 'test',
          'public-key': 'publickey',
          'theme-id': 'test_theme_id',
        },
      });

      const theme = new SwellTheme(swell);
      theme.shopifyCompatibility = new ShopifyCompatibility(theme);

      const swellThemeConfigs: SwellThemeConfig[] = [
        {
          id: 'section_test',
          name: 'section_test',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/section_test.json',
          file_data: JSON.stringify({
            name: 'Test section',
            type: 'test',
            tag: 'section',
            class: 'section',
            sections: {
              section_1: {
                type: 'section_1',
                settings: {},
              },
            },
          } as ThemeSectionGroup),
        },
        {
          id: 'section_1',
          name: 'section_1',
          type: 'theme',
          hash: '',
          file: {} as SwellFile,
          file_path: 'theme/sections/section_1.json',
          file_data: JSON.stringify({
            name: 'Test section 1',
            tag: 'section',
            class: 'section',
            sections: {},
          } as ThemeSectionGroup),
        },
      ];

      const sectionGroups = await getLayoutSectionGroups(
        theme,
        swellThemeConfigs,
      );

      expect(sectionGroups).toEqual([
        {
          id: 'section_test',
          label: 'Test section',
          type: 'test',
          sections: { section_1: { type: 'section_1', settings: {} } },
          order: undefined,
          sectionConfigs: [
            {
              id: 'section_1',
              settings: {
                section: {
                  id: 'section_1',
                  type: 'section_1',
                  settings: {},
                  blocks: [],
                  location: 'custom.section_1',
                  index0: 0,
                  index: 1,
                },
              },
              section: { id: 'section_1', type: 'section_1', settings: {} },
              tag: 'section',
              class: 'section',
              schema: {
                type: undefined,
                label: 'Test section 1',
                tag: 'section',
                class: 'section',
                id: 'section_1',
                enabled_on: undefined,
                disabled_on: undefined,
                limit: undefined,
                fields: [],
                blocks: [],
                presets: [],
                default: undefined,
              },
            },
          ],
        },
      ]);
    });
  });

  describe('schemaToEasyblocksProps', () => {
    it('unknown', () => {
      const result = schemaToEasyblocksProps({
        type: 'unknown' as 'text',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'unknown', label: 'Test field' },
        type: 'swell_short_text',
      });
    });

    it('text', () => {
      const result = schemaToEasyblocksProps({
        type: 'text',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'text', label: 'Test field' },
        type: 'swell_short_text',
      });
    });

    it('short_text', () => {
      const result = schemaToEasyblocksProps({
        type: 'short_text',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'short_text', label: 'Test field' },
        type: 'swell_short_text',
      });
    });

    it('paragraph', () => {
      const result = schemaToEasyblocksProps({
        type: 'paragraph',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'paragraph', label: 'Test field' },
        type: 'swell_paragraph',
      });
    });

    it('textarea', () => {
      const result = schemaToEasyblocksProps({
        type: 'textarea',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'textarea', label: 'Test field' },
        type: 'swell_long_text',
      });
    });

    it('long_text', () => {
      const result = schemaToEasyblocksProps({
        type: 'long_text',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'long_text', label: 'Test field' },
        type: 'swell_long_text',
      });
    });

    it('liquid', () => {
      const result = schemaToEasyblocksProps({
        type: 'liquid',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'liquid', label: 'Test field' },
        type: 'swell_long_text',
      });
    });

    it('basic_html', () => {
      const result = schemaToEasyblocksProps({
        type: 'basic_html',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'basic_html', label: 'Test field' },
        type: 'swell_editor',
      });
    });

    it('rich_text', () => {
      const result = schemaToEasyblocksProps({
        type: 'rich_text',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'rich_text', label: 'Test field' },
        type: 'swell_editor',
      });
    });

    it('rich_html', () => {
      const result = schemaToEasyblocksProps({
        type: 'rich_html',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'rich_html', label: 'Test field' },
        type: 'swell_editor',
      });
    });

    it('markdown', () => {
      const result = schemaToEasyblocksProps({
        type: 'markdown',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'markdown', label: 'Test field' },
        type: 'swell_editor',
      });
    });

    it('number', () => {
      const result = schemaToEasyblocksProps({
        type: 'number',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'number', label: 'Test field' },
        type: 'swell_number',
      });
    });

    it('select', () => {
      const result = schemaToEasyblocksProps({
        type: 'select',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'select', label: 'Test field' },
        type: 'swell_select',
      });
    });

    it('radio', () => {
      const result = schemaToEasyblocksProps({
        type: 'radio',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'radio', label: 'Test field' },
        type: 'swell_radio',
      });
    });

    it('checkbox', () => {
      const result = schemaToEasyblocksProps({
        type: 'checkbox',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'checkbox', label: 'Test field' },
        type: 'swell_boolean',
      });
    });

    it('color', () => {
      const result = schemaToEasyblocksProps({
        type: 'color',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'color', label: 'Test field' },
        type: 'swell_color',
      });
    });

    it('color_scheme', () => {
      const result = schemaToEasyblocksProps({
        type: 'color_scheme',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'color_scheme', label: 'Test field' },
        type: 'swell_color_scheme',
      });
    });

    it('color_scheme_group', () => {
      const result = schemaToEasyblocksProps({
        type: 'color_scheme_group',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'color_scheme_group', label: 'Test field' },
        type: 'swell_color_scheme_group',
      });
    });

    it('font', () => {
      const result = schemaToEasyblocksProps({
        type: 'font',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'font', label: 'Test field' },
        type: 'swell_font',
      });
    });

    it('header', () => {
      const result = schemaToEasyblocksProps({
        type: 'header',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'header', label: 'Test field' },
        type: 'swell_header',
      });
    });

    it('icon', () => {
      const result = schemaToEasyblocksProps({
        type: 'icon',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'icon', label: 'Test field' },
        type: 'swell_menu',
      });
    });

    it('menu', () => {
      const result = schemaToEasyblocksProps({
        type: 'menu',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'menu', label: 'Test field' },
        type: 'swell_menu',
      });
    });

    it('url', () => {
      const result = schemaToEasyblocksProps({
        type: 'url',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'url', label: 'Test field' },
        type: 'swell_url',
      });
    });

    it('lookup', () => {
      const result = schemaToEasyblocksProps({
        type: 'lookup',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'lookup', label: 'Test field' },
        type: 'swell_lookup',
      });
    });

    it('generic_lookup', () => {
      const result = schemaToEasyblocksProps({
        type: 'generic_lookup',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'generic_lookup', label: 'Test field' },
        type: 'swell_lookup',
      });
    });

    it('product_lookup', () => {
      const result = schemaToEasyblocksProps({
        type: 'product_lookup',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'product_lookup', label: 'Test field' },
        type: 'swell_lookup',
      });
    });

    it('category_lookup', () => {
      const result = schemaToEasyblocksProps({
        type: 'category_lookup',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'category_lookup', label: 'Test field' },
        type: 'swell_lookup',
      });
    });

    it('customer_lookup', () => {
      const result = schemaToEasyblocksProps({
        type: 'customer_lookup',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'customer_lookup', label: 'Test field' },
        type: 'swell_lookup',
      });
    });

    it('image', () => {
      const result = schemaToEasyblocksProps({
        type: 'image',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: null,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'image', label: 'Test field' },
        type: 'swell_image',
      });
    });

    it('asset', () => {
      const result = schemaToEasyblocksProps({
        type: 'asset',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'asset', label: 'Test field' },
        type: 'swell_file',
      });
    });

    it('document', () => {
      const result = schemaToEasyblocksProps({
        type: 'document',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'document', label: 'Test field' },
        type: 'swell_file',
      });
    });

    it('video', () => {
      const result = schemaToEasyblocksProps({
        type: 'video',
        label: 'Test field',
      });

      expect(result).toEqual({
        description: undefined,
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: { type: 'video', label: 'Test field' },
        type: 'swell_file',
      });
    });

    it('should have a description', () => {
      const result = schemaToEasyblocksProps({
        type: 'text',
        label: 'Test field',
        description: 'Test description',
      });

      expect(result).toEqual({
        description: 'Test description',
        defaultValue: undefined,
        isLabelHidden: true,
        layout: 'column',
        params: {
          type: 'text',
          label: 'Test field',
          description: 'Test description',
        },
        type: 'swell_short_text',
      });
    });
  });

  describe('schemaToEasyblocksValue', () => {
    it('should return the original value', () => {
      const fields: ThemeSettingFieldSchema[] = [];
      const value = 1;

      const result = schemaToEasyblocksValue(fields, 'field1', value);

      expect(result).toStrictEqual(value);
    });

    it('should return null', () => {
      const fields: ThemeSettingFieldSchema[] = [];
      const value = undefined;

      const result = schemaToEasyblocksValue(fields, 'field1', value);

      expect(result).toStrictEqual(null);
    });
  });
});
