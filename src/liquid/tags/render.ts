import { assign } from 'lodash-es';

import {
  Liquid,
  Tag,
  TagToken,
  Context,
  Hash,
  evalToken,
} from 'liquidjs';

import { LiquidSwell } from '..';
import { ForloopDrop, toEnumerable } from '../utils';

import type { ValueToken, TopLevelToken } from 'liquidjs';
import type { QuotedToken, IdentifierToken } from 'liquidjs/dist/tokens';
import type { TagClass } from 'liquidjs/dist/template';

// {% render 'component', variable: value %}
// {% render 'component' for array as item %}
// {% render 'component' with object as name %}
// Preferred over { % include % } for rendering components

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class RenderTag extends Tag {
    private fileName: string;
    private hash: Hash;
    private args: {
      with?: { value: ValueToken; alias?: IdentifierToken['content'] };
      for?: { value: ValueToken; alias?: IdentifierToken['content'] };
    } = {};

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);
      const tokenizer = this.tokenizer;

      this.fileName = (tokenizer.readValue() as QuotedToken)?.content;

      while (!tokenizer.end()) {
        const begin = tokenizer.p;
        const keyword = tokenizer.readIdentifier();
        if (keyword.content === 'with' || keyword.content === 'for') {
          tokenizer.skipBlank();
          // can be normal key/value pair, like "with: true"
          if (tokenizer.peek() !== ':') {
            const value = tokenizer.readValue();
            // can be normal key, like "with,"
            if (value) {
              const beforeAs = tokenizer.p;
              const asStr = tokenizer.readIdentifier();
              let alias;
              if (asStr.content === 'as') alias = tokenizer.readIdentifier();
              else tokenizer.p = beforeAs;

              this.args[keyword.content] = {
                value,
                alias: alias && alias.content,
              };
              tokenizer.skipBlank();
              if (tokenizer.peek() === ',') tokenizer.advance();
              continue; // matched!
            }
          }
        }
        /**
         * restore cursor if with/for not matched
         */
        tokenizer.p = begin;
        break;
      }

      this.hash = new Hash(tokenizer.remaining());
    }

    *render(ctx: Context): any {
      const { hash } = this;

      const themeConfig = yield liquidSwell.getThemeConfig(
        yield liquidSwell.getComponentPath(this.fileName),
      );

      const childCtx = new Context({}, ctx.opts, {
        sync: ctx.sync,
        globals: ctx.globals,
        strictVariables: ctx.strictVariables,
      });

      const scope = childCtx.bottom() as { [key: string]: any };
      assign(scope, yield hash.render(ctx));

      // Append section from parent scope if present
      const parentSection = yield ctx._get(['section']);
      if (parentSection) assign(scope, { section: parentSection });

      let output = '';

      if (this.args['with']) {
        const { value, alias } = this.args['with'];
        const aliasName = alias || this.fileName;
        scope[aliasName] = yield evalToken(value, ctx);
      }

      if (this.args['for']) {
        const { value, alias } = this.args['for'];
        const collection = toEnumerable(yield evalToken(value, ctx));
        scope['forloop'] = new ForloopDrop(
          collection.length,
          value.getText(),
          alias as string,
        ) as ForloopDrop;
        for (const item of collection) {
          scope[alias as string] = item;
          output += yield liquidSwell.renderTemplate(themeConfig, scope);

          (scope['forloop'] as ForloopDrop).next();
        }
      } else {
        output += yield liquidSwell.renderTemplate(themeConfig, scope);
      }

      return output;
    }
  };
}
