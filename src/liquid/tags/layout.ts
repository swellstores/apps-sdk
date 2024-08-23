import { Liquid, Tag, TagToken, Context } from 'liquidjs';

import { LiquidSwell } from '..';

import type { TopLevelToken } from 'liquidjs';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass } from 'liquidjs/dist/template';

// {% layout 'name' %}
// {% layout none %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class LayoutTag extends Tag {
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

    *render(ctx: Context): any {
      // Layout is actually rendered separately
      liquidSwell.layoutName = this.fileName;
      return "";
    }
  };
}
