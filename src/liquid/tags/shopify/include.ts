import { Tag, Hash } from 'liquidjs';

import type { LiquidSwell } from '../..';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';
import type {
  Liquid,
  TagToken,
  Context,
  Parser,
  Scope,
  TopLevelToken,
} from 'liquidjs';

// Deprecated in Shopify, supported for backward compatibility
// Replaced by {% render %}

// {% include 'component' %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class IncludeTag extends Tag {
    private fileName: string;
    private hash: Hash;

    // Implementation adapted from liquidjs/src/tags/include.ts
    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      _parser: Parser,
    ) {
      super(token, remainTokens, liquid);
      const { tokenizer } = token;
      this.fileName = (tokenizer.readValue() as QuotedToken)?.content;

      this.hash = new Hash(tokenizer.remaining());
    }

    *render(ctx: Context): TagRenderReturn {
      const { hash } = this;

      const scope = (yield hash.render(ctx)) as Scope;
      ctx.push(scope);

      const themeConfig = yield liquidSwell.getThemeConfig(
        yield liquidSwell.getComponentPath(this.fileName),
      );
      const output = yield liquidSwell.renderTemplate(
        themeConfig,
        scope as { [key: string]: any },
      );

      ctx.pop();

      return output;
    }
  };
}
