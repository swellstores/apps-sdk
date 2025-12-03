import { Tokenizer } from 'liquidjs';
import { IdentifierToken } from './tokens';

const isNumber = (c: string) => c >= '0' && c <= '9';

const isCharacter = (c: string) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

const isWord = (c: string) =>
  '_-?'.includes(c) || isCharacter(c) || isNumber(c);

export default class TokenizerSwell extends Tokenizer {
  readIdentifier(): IdentifierToken {
    this.skipBlank();
    const begin = this.p;

    while (!this.end()) {
      const char = this.peek();

      if (isWord(char) || char === '.') {
        this.p++;
      } else {
        break;
      }
    }

    return new IdentifierToken(this.input, begin, this.p, this.file);
  }
}
