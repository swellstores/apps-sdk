import { assert, evalToken, IncludeTag as LiquidIncludeTag } from 'liquidjs';

import { renderFilePath } from '../render';

import type { LiquidSwell } from '../..';
import type { TagClass } from 'liquidjs/dist/template';
import type { Context, Scope, Emitter } from 'liquidjs';

// Deprecated in Shopify, supported for backward compatibility
// Replaced by {% render %}

// {% include 'component' %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class IncludeTag extends LiquidIncludeTag {
    *render(
      this: any,
      ctx: Context,
      emitter: Emitter,
    ): Generator<unknown, void, unknown> {
      const { hash } = this;

      const filepath = (yield renderFilePath(
        this['file'],
        ctx,
        this.liquid,
      )) as string;

      assert(filepath, () => `illegal file path "${filepath}"`);

      const saved = ctx.saveRegister('blocks', 'blockMode');
      ctx.setRegister('blocks', {});
      ctx.setRegister('blockMode', 0);

      const scope = (yield hash.render(ctx)) as Scope;

      if (this.withVar) {
        (scope as any)[filepath] = yield evalToken(this.withVar, ctx);
      }

      ctx.push(ctx.opts.jekyllInclude ? { include: scope } : scope);

      const output = yield liquidSwell
        .getComponentPath(filepath)
        .then((path) => liquidSwell.getThemeConfig(path))
        .then((themeConfig) => liquidSwell.renderTemplate(themeConfig, ctx));

      emitter.write(output);

      ctx.pop();
      ctx.restoreRegister(saved);
    }
  };
}
