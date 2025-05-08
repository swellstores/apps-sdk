import { Tag, TypeGuards } from 'liquidjs';

import type { LiquidSwell } from '..';
import type { Liquid, TopLevelToken, TagToken } from 'liquidjs';
import type { TagClass } from 'liquidjs/dist/template';

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class CommentTag extends Tag {
    constructor(
      tagToken: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(tagToken, remainTokens, liquid);

      let nested = 1;

      while (remainTokens.length > 0) {
        const token = remainTokens.shift();

        if (TypeGuards.isTagToken(token)) {
          switch (token.name) {
            case 'comment':
              // Nested comment tag
              nested += 1;
              break;

            case 'endcomment': {
              nested -= 1;

              if (nested === 0) {
                // End of comment
                return;
              }

              break;
            }

            default:
              // Ignore other tags inside the comment
              break;
          }
        }
      }

      throw new Error(`tag ${tagToken.getText()} not closed`);
    }

    render() {}
  };
}
