import { LiquidSwell } from "..";
import {
  Liquid,
  Tag,
  TagToken,
  Context,
  Hash,
  TopLevelToken,
  Template,
  TypeGuards,
} from 'liquidjs';
import { QuotedToken } from 'liquidjs/dist/tokens';

// {% form 'form_type' %}
// {% form 'form_type', param %}
// {% form 'form_type', return_to: 'url %}

export default function bind(liquidSwell: LiquidSwell) {
  return class FormTag extends Tag {
    private formConfig: any;
    private templates: Template[] = [];
    private hash: Hash;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);
      const { tokenizer } = token;
      const formType = (tokenizer.readValue() as QuotedToken)?.content;

      this.formConfig = liquidSwell.globals.storefrontConfig?.forms?.find(
        (form: any) => form.id === formType,
      );
      if (!this.formConfig) {
        throw new Error(
          `form '${formType}' not found in global 'storefrontConfig.forms'`,
        );
      }

      this.hash = new Hash(this.tokenizer.remaining());

      while (remainTokens.length) {
        const token = remainTokens.shift()!;
        if (TypeGuards.isTagToken(token) && token.name === 'endform') return;
        this.templates.push(liquid.parser.parseToken(token, remainTokens));
      }

      throw new Error(`tag ${token.getText()} not closed`);
    }

    *render(ctx: Context): any {
      const r = this.liquid.renderer;
      const html = yield r.renderTemplates(this.templates, ctx);
      const hash = yield this.hash.render(ctx);

      // const scope = ctx.getAll() as any;

      const attrs =
        ' ' +
        Object.entries(hash)
          .reduce((acc: any, [key, value]: Array<any>) => {
            if (value !== true) {
              // true represents the form type
              return [...acc, `${key}="${value}"`];
            }
            return acc;
          }, [])
          .join(' ');

      let compatibilityHtml = '';
      if (liquidSwell.theme.shopifyCompatibility) {
        const compatibilityOutput =
          yield liquidSwell.theme.shopifyCompatibility.getAdaptedFormHtml(
            this.formConfig.id,
          );
        if (compatibilityOutput) {
          compatibilityHtml = yield liquidSwell.renderTemplateString(
            compatibilityOutput,
          );
        }
      }

      return `
        <form action="${
          this.formConfig.url
        }" method="post" accept-charset="UTF-8" enctype="multipart/form-data"${attrs}>
          <input type="hidden" name="form_type" value="${this.formConfig.id}" />
          ${
            hash.return_to
              ? `<input type="hidden" name="return_to" value="${hash.return_to}" />`
              : ''
          }
          ${compatibilityHtml}
          ${html}
        </form>
      `;
    }
  };
}
