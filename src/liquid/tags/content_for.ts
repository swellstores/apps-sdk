import { Hash, Tag } from 'liquidjs';
import { assign } from 'lodash-es';
import HashSwell from '../hash';

import type {
  Liquid,
  Context,
  Emitter,
  TagToken,
  TopLevelToken,
} from 'liquidjs';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass, Template } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';
import { isObject } from '@/utils';

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class ContentForTag extends Tag {
    name: string;

    private hash: Hash;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);

      const tokenizer = token.tokenizer;

      this.name = (tokenizer.readValue() as QuotedToken)?.content;
      this.hash = new HashSwell(tokenizer.remaining());
    }

    *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      const section = yield ctx._get(['section']);
      const block = yield ctx._get(['block']);
      const hash = yield this.hash.render(ctx);
      const blocks = this.getBlocks(section, block, hash);

      for (const block of blocks) {
        if (!isObject(block) || typeof block.type !== 'string') {
          continue;
        }

        const blockPath = (yield liquidSwell.getThemeBlockPath(
          block.type,
        )) as string;

        if (!blockPath) {
          continue;
        }

        const childCtx = ctx.spawn();
        const scope = childCtx.bottom() as Record<string, unknown>;

        assign(scope, { section });
        assign(scope, { block });
        assign(scope, hash);

        const templates = (yield this.liquid._parseFile(
          blockPath,
          childCtx.sync,
        )) as Template[];

        yield this.liquid.renderer.renderTemplates(
          templates,
          childCtx,
          emitter,
        );
      }
    }

    getBlocks(section: unknown, block: unknown, hash: unknown): unknown[] {
      const blockConfigs = this.getBlockConfigs(section, block);

      if (!isObject(hash) || !hash.type) {
        return blockConfigs;
      }

      const blockConfig = blockConfigs.find(
        (blockConfig) =>
          isObject(blockConfig) && blockConfig.type === hash.type,
      );

      return blockConfig ? [blockConfig] : [];
    }

    getBlockConfigs(section: unknown, block: unknown): unknown[] {
      if (isObject(block) && block.blocks) {
        return Object.values(block.blocks);
      }

      if (isObject(section) && Array.isArray(section.blocks)) {
        return section.blocks;
      }

      return [];
    }
  };
}
