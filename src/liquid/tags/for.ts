import {
  Liquid,
  Tag,
  TagToken,
  Context,
  Hash,
  ParseStream,
  evalToken,
} from 'liquidjs';

import { LiquidSwell } from '..';
import { ForloopDrop, toEnumerable, isObject } from '../utils';

import type { Emitter, Template, ValueToken, TopLevelToken } from 'liquidjs';
import type { TagClass } from 'liquidjs/dist/template';

const MODIFIERS = ['offset', 'limit', 'reversed'];

// Adapted from liquidjs/src/tags/for.ts
// 1) to use our own toEnumerable implementation for compatibility

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class ForTag extends Tag {
    variable: string;
    collection: ValueToken;
    hash: Hash;
    templates: Template[];
    elseTemplates: Template[];

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);

      const variable = this.tokenizer.readIdentifier();
      const inStr = this.tokenizer.readIdentifier();
      const collection = this.tokenizer.readValue();
      if (!variable.size() || inStr.content !== 'in' || !collection) {
        throw new Error(`illegal tag: ${token.getText()}`);
      }

      this.variable = variable.content;
      this.collection = collection;
      this.hash = new Hash(this.tokenizer.remaining());
      this.templates = [];
      this.elseTemplates = [];

      let p;
      const stream: ParseStream = this.liquid.parser
        .parseStream(remainTokens)
        .on('start', () => (p = this.templates))
        .on('tag:else', () => (p = this.elseTemplates))
        .on('tag:endfor', () => stream.stop())
        .on('template', (tpl: Template) => p.push(tpl))
        .on('end', () => {
          throw new Error(`tag ${token.getText()} not closed`);
        });

      stream.start();
    }

    *render(ctx: Context, emitter: Emitter): any {
      const r = this.liquid.renderer;

      let collection = yield evalToken(this.collection, ctx);

      // Get swell collection if needed
      if (!collection?._result && collection?._get) {
        yield collection._get();
      } else if (!(collection instanceof Array)) {
        collection = toEnumerable(collection);
      }

      if (!collection.length) {
        yield r.renderTemplates(this.elseTemplates, ctx, emitter);
        return;
      }

      const continueKey =
        'continue-' + this.variable + '-' + this.collection.getText();
      ctx.push({ continue: ctx.getRegister(continueKey) });
      const hash = yield this.hash.render(ctx);
      ctx.pop();

      const modifiers = this.liquid.options.orderedFilterParameters
        ? Object.keys(hash).filter((x) => MODIFIERS.includes(x))
        : MODIFIERS.filter((x) => (hash as any)[x] !== undefined);

      collection = modifiers.reduce((collection, modifier: any) => {
        if (modifier === 'offset')
          return offset(collection, (hash as any)['offset']);
        if (modifier === 'limit')
          return limit(collection, (hash as any)['limit']);
        return reversed(collection);
      }, collection);

      ctx.setRegister(
        continueKey,
        ((hash as any)['offset'] || 0) + collection.length,
      );

      const scope = {
        forloop: new ForloopDrop(
          collection.length,
          this.collection.getText(),
          this.variable,
        ),
      };

      ctx.push(scope);

      let index = 0;
      for (const item of collection) {
        if (isObject(item)) {
          // index is expected by some shopify templates
          item.index = index++;
        }

        (scope as any)[this.variable] = item;
        yield r.renderTemplates(this.templates, ctx, emitter);

        if ((emitter as any)['break']) {
          (emitter as any)['break'] = false;
          break;
        }

        (emitter as any)['continue'] = false;

        scope.forloop.next();
      }
      ctx.pop();
    }
  };
}

function reversed<T>(arr: Array<T>) {
  return [...arr].reverse();
}

function offset<T>(arr: Array<T>, count: number) {
  return arr.slice(count);
}

function limit<T>(arr: Array<T>, count: number) {
  return arr.slice(0, count);
}
