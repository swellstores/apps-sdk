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

// {% layout 'name' %}
// {% layout none %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class LayoutTag extends Tag {
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
      // Layout is actually rendered separately
      liquidSwell.layoutName = this.fileName;
      return '';
    }
  };
}
