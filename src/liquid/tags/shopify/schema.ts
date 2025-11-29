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
          // Parse the JSON schema from the rendered {% schema %} tag
          liquidSwell.lastSchema = JSON5.parse(jsonOutput);

          // Replace any "@theme" in blocks with actual theme blocks
          expandThemeBlocks(liquidSwell);
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

/**
 * Replaces any "@theme" entries in section.blocks
 * with the actual theme block schemas from /blocks.
 */
function expandThemeBlocks(liquidSwell: LiquidSwell) {
  const blocks = liquidSwell.lastSchema?.blocks;

  if (!Array.isArray(blocks)) {
    return;
  }

  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === '@theme') {
      blocks.splice(i, 1, ...liquidSwell.theme.getAllThemeBlockSchemas());
    }
  }
}
