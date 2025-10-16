import { Tag, Value, evalToken, toValue } from 'liquidjs';

import type { LiquidSwell } from '..';
import type {
  Template,
  ValueToken,
  TopLevelToken,
  Emitter,
  Parser,
  Liquid,
  TagToken,
  Context,
  ParseStream,
} from 'liquidjs';
import type {
  TagClass,
  Arguments,
  TagRenderReturn,
} from 'liquidjs/dist/template';

/*
{% case variable %}
  {% when first_value %}
    first_expression
  {% when second_value %}
    second_expression
  {% else %}
    third_expression
{% endcase %}
*/

// Note: Re-implemented to support wrapping blocks in container elements for theme editor functionality

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class CaseTag extends Tag {
    value: Value;
    branches: { values: ValueToken[]; templates: Template[] }[];
    elseTemplates: Template[];
    isBlock: boolean;

    constructor(
      tagToken: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(tagToken, remainTokens, liquid);

      // Determine if the variable is a block
      const begin = this.tokenizer.p;
      const caseVar = (this.tokenizer.readValue() as ValueToken)?.getText();
      this.isBlock = Boolean(caseVar?.startsWith('block.'));
      this.tokenizer.p = begin;

      this.value = new Value(this.tokenizer.readFilteredValue(), this.liquid);
      this.branches = [];
      this.elseTemplates = [];

      let p: Template[] = [];
      let elseCount = 0;
      const stream: ParseStream = parser
        .parseStream(remainTokens)
        .on('tag:when', (token: TagToken) => {
          if (elseCount > 0) {
            return;
          }

          p = [];

          const values: ValueToken[] = [];
          while (!token.tokenizer.end()) {
            values.push(token.tokenizer.readValueOrThrow());
            token.tokenizer.skipBlank();
            if (token.tokenizer.peek() === ',') {
              token.tokenizer.readTo(',');
            } else {
              token.tokenizer.readTo('or');
            }
          }
          this.branches.push({
            values,
            templates: p,
          });
        })
        .on('tag:else', () => {
          elseCount++;
          p = this.elseTemplates;
        })
        .on('tag:endcase', () => stream.stop())
        .on('template', (tpl: Template) => {
          if (p !== this.elseTemplates || elseCount === 1) {
            p.push(tpl);
          }
        })
        .on('end', () => {
          throw new Error(`tag ${tagToken.getText()} not closed`);
        });

      stream.start();
    }

    *render(ctx: Context, emitter: Emitter): TagRenderReturn {
      const r = this.liquid.renderer;
      const target = toValue(yield this.value.value(ctx, ctx.opts.lenientIf));
      let branchHit = false;

      let output = '';
      for (const branch of this.branches) {
        for (const valueToken of branch.values) {
          const value = yield evalToken(valueToken, ctx, ctx.opts.lenientIf);
          if (target === value) {
            const blockOutput = yield r.renderTemplates(branch.templates, ctx);
            output += blockOutput;
            branchHit = true;
            break;
          }
        }
      }

      if (!branchHit) {
        output += yield r.renderTemplates(this.elseTemplates, ctx);
      }

      if (output) {
        emitter.write(output);
      }

      return;
    }

    public *arguments(): Arguments {
      yield this.value;
      yield* this.branches.flatMap((b) => b.values);
    }

    // eslint-disable-next-line require-yield
    public *children(): Generator<unknown, Template[]> {
      const templates = this.branches.flatMap((b) => b.templates);
      if (this.elseTemplates) {
        templates.push(...this.elseTemplates);
      }
      return templates;
    }
  };
}
