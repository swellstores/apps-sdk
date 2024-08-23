import {
  Liquid,
  Tag,
  TagToken,
  Context,
  TypeGuards,
} from 'liquidjs';

import { LiquidSwell } from '..';

import type { Template, TopLevelToken } from 'liquidjs';
import type { TagClass } from 'liquidjs/dist/template';

// {% javascript %}

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class JavascriptTag extends Tag {
    private templates: Template[] = [];

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);

      while (remainTokens.length) {
        const token = remainTokens.shift()!;
        if (TypeGuards.isTagToken(token) && token.name === "endjavascript")
          return;
        this.templates.push(liquid.parser.parseToken(token, remainTokens));
      }

      throw new Error(`tag ${token.getText()} not closed`);
    }

    *render(ctx: Context): any {
      const r = this.liquid.renderer;
      const javascript = yield r.renderTemplates(this.templates, ctx);

      return `<script type="text/javascript" data-swell>${javascript}</script>`;
    }
  };
}
