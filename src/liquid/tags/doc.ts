import { Tag } from 'liquidjs';
import type {
  Liquid,
  TagToken,
  TopLevelToken,
  Parser,
  ParseStream,
} from 'liquidjs';

import type { TagClass } from 'liquidjs/dist/template';

export default function bind(): TagClass {
  return class DocTag extends Tag {
    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      const stream: ParseStream = parser
        .parseStream(remainTokens)
        .on<TagToken>('tag:enddoc', () => {
          stream.stop();
        });

      stream.start();
    }

    render() {}
  };
}
