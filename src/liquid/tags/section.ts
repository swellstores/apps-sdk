import { Tag } from 'liquidjs';

import type { LiquidSwell } from '..';
import type {
  Liquid,
  TagToken,
  Context,
  Parser,
  TopLevelToken,
} from 'liquidjs';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';

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

    *render(_ctx: Context): TagRenderReturn {
      const filePath = yield liquidSwell.getSectionPath(this.fileName);
      const themeConfig = yield liquidSwell.getThemeConfig(filePath);

      if (!themeConfig) {
        console.error(`Section not found: ${filePath}`);
        return;
      }

      const sectionSchema =
        yield liquidSwell.theme.getTemplateSchema(themeConfig);

      const defaultSettings =
        yield liquidSwell.theme.resolveSectionDefaultSettings(sectionSchema);

      return yield liquidSwell.renderTemplate(themeConfig, {
        section: defaultSettings,
      });
    }
  };
}
