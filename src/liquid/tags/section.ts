import { Liquid, Tag, TagToken, Context } from 'liquidjs';
import { QuotedToken } from 'liquidjs/dist/tokens';

import { LiquidSwell } from '..';

import type { TopLevelToken } from 'liquidjs';
import type { TagClass } from 'liquidjs/dist/template';

// {% section 'name' %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class SectionTag extends Tag {
    private fileName: string;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);
      const { tokenizer } = token;
      this.fileName = (tokenizer.readValue() as QuotedToken)?.content;
    }

    *render(_ctx: Context): any {
      const filePath = yield liquidSwell.getSectionPath(this.fileName);
      const themeConfig = yield liquidSwell.getThemeConfig(filePath);

      if (!themeConfig) {
        console.error(`Section not found: ${filePath}`);
        return;
      }

      const sectionSchema = yield liquidSwell.theme.getTemplateSchema(
        themeConfig,
      );

      const defaultSettings =
        yield liquidSwell.theme.resolveSectionDefaultSettings(sectionSchema);

      return yield liquidSwell.renderTemplate(themeConfig, {
        section: defaultSettings,
      });
    }
  };
}
