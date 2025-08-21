import { Tag, Hash, evalToken } from 'liquidjs';

import {
  SwellStorefrontCollection,
  SwellStorefrontPagination,
} from '../../resources';

import ShopifyPaginate from '@/compatibility/shopify-objects/paginate';

import type { LiquidSwell } from '..';
import type {
  Liquid,
  TagToken,
  Parser,
  Context,
  ParseStream,
  Emitter,
  Template,
  ValueToken,
  TopLevelToken,
} from 'liquidjs';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';

/*
  {% paginate array by page_size %}
    {% for item in array %}
      forloop_content
    {% endfor %}
  {% endpaginate %}
*/

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class PaginateTag extends Tag {
    private collection: ValueToken;
    private pageSize: ValueToken | undefined;
    private templates: Template[];
    private hash: Hash;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      const collection = this.tokenizer.readValue();
      const byStr = this.tokenizer.readIdentifier();
      this.pageSize = this.tokenizer.readValue();
      if (byStr.content !== 'by' || !collection) {
        throw new Error(`illegal tag: ${token.getText()}`);
      }

      this.templates = [];
      this.collection = collection;
      this.hash = new Hash(this.tokenizer.remaining());

      const stream: ParseStream = parser
        .parseStream(remainTokens)
        .on('tag:endpaginate', () => stream.stop())
        .on('template', (tpl: Template) => {
          this.templates.push(tpl);
        })
        .on('end', () => {
          throw new Error(`tag ${token.getText()} not closed`);
        });

      stream.start();
    }

    *render(ctx: Context, emitter: Emitter): TagRenderReturn {
      const r = this.liquid.renderer;

      const collection = yield evalToken(this.collection, ctx);
      const pageSize = Number(yield evalToken(this.pageSize, ctx));
      const hash = yield this.hash.render(ctx);

      if (
        !Number.isNaN(pageSize) &&
        collection instanceof SwellStorefrontCollection &&
        collection.limit !== pageSize
      ) {
        yield collection._get({
          limit: pageSize,
          window: hash.window_size || undefined,
        });
      }

      if (collection) {
        const paginate = new SwellStorefrontPagination(collection);
        if (liquidSwell.theme.shopifyCompatibility) {
          paginate.setCompatibilityProps(
            ShopifyPaginate(liquidSwell.theme.shopifyCompatibility, paginate),
          );
        }

        ctx.push({ paginate });
      }

      yield r.renderTemplates(this.templates, ctx, emitter);

      if (collection) {
        ctx.pop();
      }
    }
  };
}
