import { set } from 'lodash-es';
import { Hash, Context, Tokenizer, evalToken } from 'liquidjs';
import TokenizerSwell from './tokienizer';

export default class HashSwell extends Hash {
  constructor(input: string | Tokenizer, jekyllStyle?: boolean | string) {
    super(input, jekyllStyle);

    const tokenizer =
      input instanceof Tokenizer ? input : new TokenizerSwell(input, {});

    for (const hash of tokenizer.readHashes(jekyllStyle)) {
      this.hash[hash.name.content] = hash.value;
    }
  }

  *render(ctx: Context): Generator<unknown, Record<string, unknown>, unknown> {
    const hash: Record<string, unknown> = {};

    for (const key of Object.keys(this.hash)) {
      const token = this.hash[key];

      if (token !== undefined) {
        const value = yield evalToken(token, ctx);

        set(hash, key, value);
      }
    }

    return hash;
  }
}
