import { Tag } from 'liquidjs';

import type { LiquidSwell } from '..';
import type {
  Liquid,
  TagToken,
  Context,
  Parser,
  TopLevelToken,
} from 'liquidjs';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';

// {% inline_editable setting: 'heading', value: block.settings.heading %}

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class InlineEditableTag extends Tag {
    private key: string;
    private value: string;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      _parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      const args = token.args.split(',').map((arg) => arg.trim());
      const settingArg = args.find((arg) => arg.startsWith('setting:'));
      const valueArg = args.find((arg) => arg.startsWith('value:'));

      this.key = settingArg
        ? settingArg.split(':')[1].trim().replace(/['"]/g, '')
        : args[0].split('.')[args[0].split('.').length - 1];

      this.value = valueArg ? valueArg.split(':')[1].trim() : args[0];
    }

    *render(ctx: Context): TagRenderReturn {
      let renderedValue = yield this.liquid.evalValue(this.value, ctx);
      if (renderedValue.value) {
        renderedValue = renderedValue.value;
      }
      return `<span data-swell-inline-editable="${this.key}">${renderedValue}</span>`;
    }
  };
}
