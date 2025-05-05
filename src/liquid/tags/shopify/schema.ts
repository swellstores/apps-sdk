import { Tag } from 'liquidjs';
import JSON5 from 'json5';

import type { LiquidSwell } from '../..';
import type {
  Liquid,
  TagToken,
  Context,
  Parser,
  Emitter,
  Template,
  TopLevelToken,
} from 'liquidjs';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';

// Swell prefers separate JSON files, but this is supported for backward compatibility

// {% schema %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class SchemaTag extends Tag {
    private templates: Template[];

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      this.templates = [];

      parser
        .parseStream(remainTokens)
        .on('template', (tpl: Template) => {
          this.templates.push(tpl);
        })
        .on('tag:endschema', function () {
          this.stop();
        })
        .on('end', () => {
          throw new Error(`tag ${token.getText()} not closed`);
        })
        .start();
    }

    *render(ctx: Context, _emitter: Emitter): TagRenderReturn {
      const jsonOutput = yield this.liquid.renderer.renderTemplates(
        this.templates,
        ctx,
      );

      try {
        liquidSwell.lastSchema = undefined;

        if (typeof jsonOutput === 'string') {
          liquidSwell.lastSchema = JSON5.parse(jsonOutput);
        }
      } catch (err) {
        console.warn(err);
        liquidSwell.lastSchema = undefined;
      }

      // no output
      return;
    }
  };
}
