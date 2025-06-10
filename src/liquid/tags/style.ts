import { Tag, TypeGuards } from 'liquidjs';
import { md5 } from '@/utils';

import type { LiquidSwell } from '..';
import type {
  Liquid,
  TagToken,
  Context,
  Parser,
  Template,
  TopLevelToken,
  Emitter,
} from 'liquidjs';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';

// {% style %} div: { color: {{ settings.color }}; } {% endstyle %}

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class StyleTag extends Tag {
    private templates: Template[];
    private hash: string;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      this.templates = [];
      const tagBegin = token.begin;

      while (remainTokens.length > 0) {
        const token = remainTokens.shift() as TopLevelToken;

        if (TypeGuards.isTagToken(token) && token.name === 'endstyle') {
          this.hash = md5(token.input.slice(tagBegin, token.end));
          return;
        }

        this.templates.push(parser.parseToken(token, remainTokens));
      }

      throw new Error(`tag ${token.getText()} not closed`);
    }

    *render(ctx: Context, emitter: Emitter): TagRenderReturn {
      const r = this.liquid.renderer;
      const css = yield r.renderTemplates(this.templates, ctx);
      // add section id to hash if presents
      const contextEnvironments = ctx?.environments as {
        section: { id: string };
      };
      const styleSectionId = contextEnvironments?.section?.id || '';
      let hash = this.hash;
      if (styleSectionId) {
        hash = md5(`${hash}${styleSectionId}`);
      }

      // This is used to update CSS in real-time from the theme editor without a page refresh
      emitter.write(`<style data-swell data-hash="${hash}">${css}</style>`);
    }
  };
}
