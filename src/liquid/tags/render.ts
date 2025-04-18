import { assign } from 'lodash-es';
import { assert, evalToken, RenderTag as LiquidRenderTag } from 'liquidjs';

import { ForloopDrop, resolveEnumerable } from '../utils';

import type { LiquidSwell } from '..';
import type { Context, Emitter, Liquid } from 'liquidjs';
import type { TagClass } from 'liquidjs/dist/template';
import type { SwellThemeConfig } from 'types/swell';
import type { ParsedFileName } from 'liquidjs/dist/tags/render';

// {% render 'component', variable: value %}
// {% render 'component' for array as item %}
// {% render 'component' with object as name %}
// Preferred over { % include % } for rendering components

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class RenderTag extends LiquidRenderTag {
    *render(
      this: any,
      ctx: Context,
      emitter: Emitter,
    ): Generator<unknown, void, unknown> {
      const { liquid, hash } = this;
      const filepath = (yield renderFilePath(
        this['file'],
        ctx,
        liquid,
      )) as string;
      assert(filepath, () => `illegal file path "${filepath}"`);

      const themeConfig = (yield liquidSwell
        .getComponentPath(filepath)
        .then((fileName) =>
          liquidSwell.getThemeConfig(fileName),
        )) as SwellThemeConfig;

      const childCtx = ctx.spawn();
      const scope = childCtx.bottom() as any;
      assign(scope, yield hash.render(ctx));

      // Append section from parent scope if present
      const parentSection = yield ctx._get(['section']);
      if (parentSection) assign(scope, { section: parentSection });

      if (this['with']) {
        const { value, alias } = this['with'];
        const aliasName = alias || filepath;
        scope[aliasName] = yield evalToken(value, ctx);
      }

      if (this['for']) {
        const { value, alias } = this['for'];
        let collection: any = yield evalToken(value, ctx);
        collection = yield resolveEnumerable(collection);

        scope['forloop'] = new ForloopDrop(
          collection.length,
          value.getText(),
          alias as string,
        );

        for (const item of collection) {
          scope[alias as string] = item;
          const output = yield liquidSwell.renderTemplate(themeConfig, scope);
          emitter.write(output);

          (scope['forloop'] as ForloopDrop).next();
        }
      } else {
        const output = yield liquidSwell.renderTemplate(themeConfig, scope);
        emitter.write(output);
      }
    }
  };
}

export function* renderFilePath(
  file: ParsedFileName,
  ctx: Context,
  liquid: Liquid,
): IterableIterator<unknown> {
  if (typeof file === 'string') return file;
  if (Array.isArray(file)) return liquid.renderer.renderTemplates(file, ctx);
  return yield evalToken(file, ctx);
}
