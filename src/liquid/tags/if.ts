import {
  assert,
  Liquid,
  Tag,
  Value,
  type Emitter,
  isTruthy,
  TagToken,
  type TopLevelToken,
  Context,
  type Template,
  Parser,
  type Arguments,
} from 'liquidjs';
import type { TagClass } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class IfTag extends Tag {
    branches: { value: Value; templates: Template[] }[] = [];
    elseTemplates: Template[] | undefined;

    constructor(
      tagToken: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(tagToken, remainTokens, liquid);
      let p: Template[] = [];
      parser
        .parseStream(remainTokens)
        .on('start', () =>
          this.branches.push({
            value: new Value(
              tagToken.tokenizer.readFilteredValue(),
              this.liquid,
            ),
            templates: (p = []),
          }),
        )
        .on('tag:elsif', (token: TagToken) => {
          assert(!this.elseTemplates, 'unexpected elsif after else');
          this.branches.push({
            value: new Value(token.tokenizer.readFilteredValue(), this.liquid),
            templates: (p = []),
          });
        })
        .on<TagToken>('tag:else', (tag) => {
          if (tag.args.length > 0) {
            this.branches.push({
              value: new Value(tag.tokenizer.readFilteredValue(), this.liquid),
              templates: (p = []),
            });
          } else {
            p = [];
            this.elseTemplates = p;
          }
        })
        .on<TagToken>('tag:endif', function (tag) {
          assertEmpty(tag.args);
          this.stop();
        })
        .on('template', (tpl: Template) => p.push(tpl))
        .on('end', () => {
          throw new Error(`tag ${tagToken.getText()} not closed`);
        })
        .start();
    }

    *render(ctx: Context, emitter: Emitter): Generator<unknown, void, string> {
      const r = this.liquid.renderer;

      for (const { value, templates } of this.branches) {
        const v = yield value.value(ctx, ctx.opts.lenientIf);
        if (isTruthy(v, ctx)) {
          yield r.renderTemplates(templates, ctx, emitter);
          return;
        }
      }
      yield r.renderTemplates(this.elseTemplates || [], ctx, emitter);
    }

    // eslint-disable-next-line require-yield
    public *children(): Generator<unknown, Template[]> {
      const templates = this.branches.flatMap((b) => b.templates);
      if (this.elseTemplates) {
        templates.push(...this.elseTemplates);
      }
      return templates;
    }

    public arguments(): Arguments {
      return this.branches.map((b) => b.value);
    }
  };
}

export function assertEmpty<T>(
  predicate: T | null | undefined,
  message = `unexpected ${JSON.stringify(predicate)}`,
): void {
  assert(!predicate, message);
}
