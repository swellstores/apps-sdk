import { Tag, TypeGuards } from 'liquidjs';

import type { LiquidSwell } from '..';
import type {
  Liquid,
  TagToken,
  Parser,
  Context,
  Emitter,
  Template,
  TopLevelToken,
} from 'liquidjs';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';

// {% javascript %}

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class JavascriptTag extends Tag {
    private templates: Template[];

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      this.templates = [];

      while (remainTokens.length > 0) {
        const token = remainTokens.shift() as TopLevelToken;

        if (TypeGuards.isTagToken(token) && token.name === 'endjavascript') {
          return;
        }

        this.templates.push(parser.parseToken(token, remainTokens));
      }

      throw new Error(`tag ${token.getText()} not closed`);
    }

    *render(ctx: Context, _emitter: Emitter): TagRenderReturn {
      const r = this.liquid.renderer;
      const javascript = yield r.renderTemplates(this.templates, ctx);

      return `<script type="text/javascript" data-swell>${javascript}</script>`;
    }
  };
}
