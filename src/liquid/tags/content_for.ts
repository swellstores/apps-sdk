import { Tag, Hash } from 'liquidjs';
import type {
  Liquid,
  Context,
  Emitter,
  TagToken,
  TopLevelToken,
  Parser,
} from 'liquidjs';

import type { QuotedToken } from 'liquidjs/dist/tokens';
import type {
  TagClass,
  TagRenderReturn,
  Template,
} from 'liquidjs/dist/template';

import type { LiquidSwell } from '..';

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class ContentForTag extends Tag {
    name: string;

    private hash: Hash;
    private templates: Template[];

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      const tokenizer = token.tokenizer;

      this.name = (tokenizer.readValue() as QuotedToken)?.content || 'blocks';
      this.hash = new Hash(tokenizer.remaining());
      this.templates = [];

      parser
        .parseStream(remainTokens)
        .on('template', (tpl: Template) => this.templates.push(tpl))
        .on('end', () => {})
        .start();
    }

    *render(ctx: Context, emitter: Emitter): TagRenderReturn {
      const hash = yield this.hash.render(ctx);
      let blocks: any[] = [];

      if (this.name === 'block') {
        if (!hash.type) {
          return;
        }

        blocks.push({ ...hash });
      } else if (this.name === 'blocks') {
        const section = yield ctx._get(['section']);

        if (!section) {
          return;
        }

        blocks = Array.isArray(section.blocks) ? section.blocks : [];
      }

      for (const block of blocks) {
        const blockPath = (yield liquidSwell.getThemeBlockPath(
          block.type,
        )) as string;

        if (!blockPath) {
          continue;
        }

        const childCtx = ctx.spawn();
        const scope = childCtx.bottom() as Record<string, unknown>;

        scope['section'] = yield ctx._get(['section']);
        scope['block'] = block;

        const templates = (yield this.liquid._parseFile(
          blockPath,
          childCtx.sync,
        )) as Template[];

        yield this.liquid.renderer.renderTemplates(
          templates,
          childCtx,
          emitter,
        );
      }
    }
  };
}
