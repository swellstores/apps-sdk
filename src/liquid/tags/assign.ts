import {
  Value,
  Liquid,
  type TopLevelToken,
  TagToken,
  Context,
  Tag,
} from 'liquidjs';
import type { IdentifierToken } from 'liquidjs/dist/tokens';
import type { Argument, TagClass } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

export default function bind(_liquidSwell: LiquidSwell): TagClass {
  return class AssignTag extends Tag {
    private key: string;
    private value?: Value;
    private identifier?: IdentifierToken;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);
      this.identifier = this.tokenizer.readIdentifier();
      this.key = this.identifier.content;
      this.tokenizer.assert(this.key, 'expected variable name');

      this.tokenizer.skipBlank();
      this.tokenizer.advance();

      try {
        this.value = new Value(this.tokenizer.readFilteredValue(), this.liquid);
      } catch (e) {
        // Ignore the error and continue
        console.warn(
          `Liquid "assign" tag: ${e instanceof Error ? e.stack : String(e)}`,
        );
        this.value = undefined;
      }
    }

    *render(ctx: Context): Generator<unknown, void, unknown> {
      if (!this.value) {
        return;
      }

      (ctx.bottom() as any)[this.key] = yield this.value.value(
        ctx,
        this.liquid.options.lenientIf,
      );
    }

    public *arguments(): Iterable<Argument | undefined> {
      yield this.value;
    }

    public *localScope(): Iterable<IdentifierToken | undefined> {
      yield this.identifier;
    }
  };
}
