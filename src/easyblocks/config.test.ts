import { getLayoutSectionGroups } from '@/utils';

import { getEasyblocksPagePropsWithConfigs } from './config';

import type { SwellFile, SwellThemeConfig, ThemeGlobals } from 'types/swell';

function themeConfig(file_path: string, data: unknown): SwellThemeConfig {
  const name = file_path.split('/').pop()?.split('.')[0] as string;

  return {
    id: name,
    name,
    type: 'theme',
    hash: '',
    file: {} as SwellFile,
    file_path,
    file_data: JSON.stringify(data),
  };
}

describe('easyblocks/config', () => {
  describe('layout section groups', () => {
    it("keeps each section's and block's key and hidden state", async () => {
      const groupConfig = themeConfig('theme/sections/footer-group.json', {
        type: 'footer',
        name: 'Footer',
        sections: {
          footer_main: {
            type: 'footer',
            settings: { heading: 'Shop' },
            blocks: {
              links_1: { type: 'link_list', settings: { title: 'A' } },
              links_2: {
                type: 'link_list',
                disabled: true,
                settings: { title: 'B' },
              },
            },
            block_order: ['links_2', 'links_1'],
          },
          newsletter: { type: 'footer', disabled: true, settings: {} },
        },
        order: ['footer_main', 'newsletter'],
      });

      const configs = new Map([[groupConfig.file_path, groupConfig]]);
      const schema = {
        label: 'Footer',
        fields: [{ id: 'heading', type: 'text', label: 'Heading' }],
        blocks: [
          {
            type: 'link_list',
            label: 'Links',
            fields: [{ id: 'title', type: 'text', label: 'Title' }],
          },
        ],
      };

      const layoutSectionGroups = await getLayoutSectionGroups(
        new Map([
          ...configs,
          [
            'theme/sections/footer.liquid',
            themeConfig('theme/sections/footer.liquid', ''),
          ],
        ]),
        async () => schema,
      );

      const { easyblocksConfig } = getEasyblocksPagePropsWithConfigs(
        {} as ThemeGlobals,
        [],
        [],
        layoutSectionGroups,
        'index',
      );

      const [page] = easyblocksConfig.templates[0].entry.swell_page as Array<
        Record<string, unknown>
      >;
      const sections = page['SectionGroup_footer-group'] as Array<
        Record<string, unknown> & { Blocks?: Array<Record<string, unknown>> }
      >;

      expect(sections.map((section) => section._id)).toEqual([
        'SectionGroup__footer-group__footer_main',
        'SectionGroup__footer-group__newsletter',
      ]);
      expect(sections.map((section) => section.disabled)).toEqual([
        false,
        true,
      ]);

      const blocks = sections[0].Blocks || [];

      expect(blocks.map((block) => String(block._id).split('__')[1])).toEqual(
        ['links_2', 'links_1'],
      );
      expect(blocks.map((block) => block.disabled)).toEqual([true, false]);
      expect(blocks[0]._component).toBe('Block__footer__link_list');
    });
  });
});
