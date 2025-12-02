import { Token, TokenKind } from 'liquidjs';

export default class IdentifierToken extends Token {
  public content: string;
  constructor(
    public input: string,
    public begin: number,
    public end: number,
    public file?: string,
  ) {
    super(TokenKind.Word, input, begin, end, file);
    this.content = this.getText();
  }
}
