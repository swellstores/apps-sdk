import { evalToken, ForTag as LiquidForTag } from 'liquidjs';

import { ForloopDrop, resolveEnumerable } from '../utils';

import type { LiquidSwell } from '..';
import type { Context, Emitter, Scope } from 'liquidjs';
import type { TagClass, Template } from 'liquidjs/dist/template';

const MODIFIERS = Object.freeze(['offset', 'limit', 'reversed']);

// Adapted from liquidjs/src/tags/for.ts
// 1) to use our own toEnumerable implementation for compatibility

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class ForTag extends LiquidForTag {
    *render(
      ctx: Context,
      emitter: Emitter,
    ): Generator<unknown, void | string, Template[]> {
      const r = this.liquid.renderer;

      let collection: unknown[] = yield evalToken(this.collection, ctx);
      collection = yield resolveEnumerable(collection);

      if (!collection.length) {
        yield r.renderTemplates(this.elseTemplates, ctx, emitter);
        return;
      }

      const continueKey =
        'continue-' + this.variable + '-' + this.collection.getText();

      ctx.push({
        continue: ctx.getRegister(continueKey) as number | undefined,
      } as Scope);

      const hash = (yield this.hash.render(ctx)) as unknown as Record<
        string,
        unknown
      >;

      ctx.pop();

      const modifiers = this.liquid.options.orderedFilterParameters
        ? Object.keys(hash).filter((x) => MODIFIERS.includes(x))
        : MODIFIERS.filter((x) => hash[x] !== undefined);

      collection = modifiers.reduce((collection: unknown[], modifier) => {
        switch (modifier) {
          case 'offset':
            return offset(collection, hash['offset'] as number);

          case 'limit':
            return limit(collection, hash['limit'] as number);

          case 'reversed':
            return reversed(collection);

          default:
            return collection;
        }
      }, collection);

      // Maximum 50 iterations
      // https://shopify.dev/docs/api/liquid/tags/for
      const length = Math.min(collection.length, 50);
      const parent = ctx.getRegister('parentloop') as ForloopDrop | undefined;

      ctx.setRegister(continueKey, ((hash['offset'] as number) || 0) + length);

      const forloop = new ForloopDrop(
        length,
        this.collection.getText(),
        this.variable,
        parent,
      );

      const scope: { forloop: ForloopDrop; [key: string]: unknown } = {
        forloop,
      };

      ctx.push(scope);
      ctx.setRegister('parentloop', forloop);

      for (let i = 0; i < length; ++i) {
        scope[this.variable] = collection[i];
        ctx.continueCalled = ctx.breakCalled = false;
        yield r.renderTemplates(this.templates, ctx, emitter);
        if (ctx.breakCalled) break;
        scope.forloop.next();
      }

      ctx.continueCalled = ctx.breakCalled = false;
      ctx.setRegister('parentloop', parent);
      ctx.pop();
    }
  };
}

function reversed<T>(arr: T[]): T[] {
  return [...arr].reverse();
}

function offset<T>(arr: T[], count: number): T[] {
  return arr.slice(count);
}

function limit<T>(arr: T[], count: number): T[] {
  return arr.slice(0, count);
}
