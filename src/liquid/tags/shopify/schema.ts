import {
  Liquid,
  Tag,
  TagToken,
  Context,
} from 'liquidjs';

import { LiquidSwell } from '../..';

import type { Template, TopLevelToken } from 'liquidjs';
import type { TagClass } from 'liquidjs/dist/template';

// Swell prefers separate JSON files, but this is supported for backward compatibility

// {% schema %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class SchemaTag extends Tag {
    private templates: Template[] = [];

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);

      this.templates = [];

      liquid.parser
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

    *render(ctx: Context): any {
      const jsonOutput = yield this.liquid.renderer.renderTemplates(
        this.templates,
        ctx,
      );

      try {
        const schema = JSON.parse(jsonOutput);
        liquidSwell.lastSchema = schema;
      } catch {
        liquidSwell.lastSchema = undefined;
      }

      return ''; // no output
    }
  };
}
