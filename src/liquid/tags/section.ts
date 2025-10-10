import { Tag } from 'liquidjs';

import type { LiquidSwell } from '..';
import type {
  Liquid,
  TagToken,
  Context,
  Parser,
  TopLevelToken,
  Emitter,
} from 'liquidjs';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';
import type {
  SwellData,
  SwellThemeConfig,
  ThemeSectionSchema,
} from '../../../types/swell';

// {% section 'name' %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class SectionTag extends Tag {
    private fileName: string;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      _parser: Parser,
    ) {
      super(token, remainTokens, liquid);
      const { tokenizer } = token;
      this.fileName = (tokenizer.readValue() as QuotedToken)?.content;
    }

    *render(_ctx: Context, emitter: Emitter): TagRenderReturn {
      const filePath = (yield liquidSwell.getSectionPath(
        this.fileName,
      )) as string;

      const themeConfig = (yield liquidSwell.getThemeConfig(
        filePath,
      )) as SwellThemeConfig | null;

      if (!themeConfig) {
        console.error(`Section not found: ${filePath}`);
        return;
      }

      let schema: ThemeSectionSchema | undefined;
      let settings: SwellData | undefined;

      const output = (yield liquidSwell.theme
        .getTemplateSchema(themeConfig)
        .then((sectionSchema) => {
          if (!sectionSchema) {
            console.error(`Section schema not found: ${filePath}`);
            return '';
          }

          schema = sectionSchema;

          const defaultSettings =
            liquidSwell.theme.resolveStaticSectionSettings(sectionSchema);

          settings = defaultSettings;

          return liquidSwell.renderTemplate(themeConfig, {
            section: {
              id: this.fileName,
              settings: { ...defaultSettings, blocks: undefined },
              blocks: defaultSettings.blocks,
              location: 'static',
            },
          });
        })) as string;

      if (output && schema && settings) {
        const tag = schema.tag || 'div';

        const sectionClassName = liquidSwell.theme.getSectionClassName();
        const sectionIdPrefix = liquidSwell.theme.getSectionIdPrefix();
        const id = `${sectionIdPrefix}-${settings.id || this.fileName}`;

        emitter.write(
          `<${tag} id="${id}" class="${sectionClassName} ${schema.class || ''}">${output}</${tag}>`,
        );

        // TODO: if we decide to support static sections
        // yield liquidSwell.theme.addPageSection(this.fileName, false);
      }
    }
  };
}
