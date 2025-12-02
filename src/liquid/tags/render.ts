import { assign } from 'lodash-es';
import { assert, evalToken, RenderTag as LiquidRenderTag } from 'liquidjs';

import { ForloopDrop, resolveEnumerable } from '../utils';

import type { LiquidSwell } from '..';
import type { Context, Emitter, Liquid, ValueToken } from 'liquidjs';
import type { Hash, TagClass, Template } from 'liquidjs/dist/template';
import type { ParsedFileName } from 'liquidjs/dist/tags/render';

// {% render 'component', variable: value %}
// {% render 'component' for array as item %}
// {% render 'component' with object as name %}
// Preferred over { % include % } for rendering components

interface TokenAlias {
  value: ValueToken;
  alias: string;
}

interface LiquidRenderTagProps {
  file: ParsedFileName;
  currentFile: string;
  hash: Hash;
  with?: TokenAlias;
  for?: TokenAlias;
}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class RenderTag extends LiquidRenderTag {
    *render(
      this: LiquidRenderTag,
      ctx: Context,
      emitter: Emitter,
    ): Generator<unknown, void, unknown> {
      const self = this as unknown as LiquidRenderTagProps;
      const { liquid } = this;
      const { hash } = self;

      const filename = (yield renderFilePath(
        self['file'],
        ctx,
        liquid,
      )) as string;
      assert(filename, () => `illegal file path "${filename}"`);

      const configPath = (yield liquidSwell.getComponentPath(
        filename,
      )) as string;

      const childCtx = ctx.spawn();
      const scope = childCtx.bottom() as Record<string, unknown>;

      // Append parent scope
      assign(scope, ctx.bottom());

      // Append section from parent scope if present
      const parentSection = yield ctx._get(['section']);
      if (parentSection) assign(scope, { section: parentSection });

      // Append block from parent scope if present
      const parentBlock = yield ctx._get(['block']);
      if (parentBlock) assign(scope, { block: parentBlock });

      // Append hash
      assign(scope, yield hash.render(ctx));

      if (self['with']) {
        const { value, alias } = self['with'];
        const aliasName = alias || filename;
        scope[aliasName] = yield evalToken(value, ctx);
      }

      if (self['for']) {
        const { value, alias } = self['for'];
        let collection: any = yield evalToken(value, ctx);
        collection = yield resolveEnumerable(collection);

        scope['forloop'] = new ForloopDrop(
          collection.length,
          value.getText(),
          alias,
        );

        for (const item of collection) {
          scope[alias] = item;

          const templates = (yield liquid._parseFile(
            configPath,
            childCtx.sync,
            undefined,
            self['currentFile'],
          )) as Template[];

          yield liquid.renderer.renderTemplates(templates, childCtx, emitter);

          (scope['forloop'] as ForloopDrop).next();
        }
      } else {
        const templates = (yield liquid._parseFile(
          configPath,
          childCtx.sync,
          undefined,
          self['currentFile'],
        )) as Template[];

        yield liquid.renderer.renderTemplates(templates, childCtx, emitter);
      }
    }
  };
}

export function* renderFilePath(
  file: ParsedFileName,
  ctx: Context,
  liquid: Liquid,
): IterableIterator<unknown> {
  switch (typeof file) {
    case 'string':
      return file;

    case 'object': {
      if (Array.isArray(file)) {
        return liquid.renderer.renderTemplates(file, ctx);
      }

      break;
    }

    default:
      break;
  }

  return yield evalToken(file, ctx);
}
