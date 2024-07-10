import { LiquidSwell } from "..";
import { ThemeForm } from '../form';
import {
  Liquid,
  Tag,
  TagToken,
  Context,
  Hash,
  TopLevelToken,
  Template,
  TypeGuards,
  evalToken,
} from 'liquidjs';
import { QuotedToken } from 'liquidjs/dist/tokens';

// {% form 'form_type' %}
// {% form 'form_type', param %}
// {% form 'form_type', return_to: 'url %}

const IGNORED_SHOPIFY_FORMS = ['new_comment', 'guest_login'];

export default function bind(liquidSwell: LiquidSwell) {
  return class FormTag extends Tag {
    private formConfig: any;
    private templates: Template[] = [];
    private hash: Hash;
    private arg: any;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);

      const { tokenizer } = token;
      const formType = (tokenizer.readValue() as QuotedToken)?.content;

      this.formConfig = liquidSwell.theme.getFormConfig(formType);

      if (!this.formConfig && !IGNORED_SHOPIFY_FORMS.includes(formType)) {
        throw new Error(`form '${formType}' not found in theme configuration.`);
      }

      tokenizer.advance();

      this.arg = tokenizer.readValue();

      this.hash = new Hash(this.tokenizer.remaining());

      while (remainTokens.length) {
        const token = remainTokens.shift()!;
        if (TypeGuards.isTagToken(token) && token.name === 'endform') return;
        this.templates.push(liquid.parser.parseToken(token, remainTokens));
      }

      throw new Error(`tag ${token.getText()} not closed`);
    }

    *render(ctx: Context): any {
      if (!this.formConfig) {
        return;
      }

      const r = this.liquid.renderer;
      const arg = yield evalToken(this.arg, ctx);
      const hash = yield this.hash.render(ctx);

      const scope = ctx.getAll() as any;

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

      const exForm = liquidSwell.theme.formData[this.formConfig.id];
      const form = exForm || new ThemeForm(this.formConfig.id);

      let compatibilityHtml = '';

      if (liquidSwell.theme.shopifyCompatibility) {
        Object.assign(
          form,
          liquidSwell.theme.shopifyCompatibility.getFormData(form),
        );

        const compatibilityOutput =
          yield liquidSwell.theme.shopifyCompatibility.getAdaptedFormClientHtml(
            this.formConfig.id,
            scope,
            arg,
          );

        if (compatibilityOutput) {
          compatibilityHtml = yield liquidSwell.renderTemplateString(
            compatibilityOutput,
          );
        }

        const compatibilityParams =
          yield liquidSwell.theme.shopifyCompatibility.getAdaptedFormClientParams(
            this.formConfig.id,
            scope,
            arg,
          );
        if (compatibilityParams) {
          form.setParams(compatibilityParams);
        }
      }

      ctx.push({ form: { ...(arg || undefined), ...form } });

      const html = yield r.renderTemplates(this.templates, ctx);

      // TODO: params and return_to
      // return_to should be used by default by the server if the middleware doesn't explicitly redirect

      const paramInputs =
        this.formConfig.params instanceof Array
          ? yield Promise.all(
              this.formConfig.params.map(async (param: any) => {
                const value = await liquidSwell.renderTemplateString(
                  param.value,
                  {
                    value: arg,
                  },
                );
                return `<input type="hidden" name="${param.name}" value="${value}" />`;
              }),
            )
          : [];

      const returnTo =
        hash.return_to || liquidSwell.theme.globals?.request?.path;

      return `
        <form action="${
          this.formConfig.url
        }" method="post" accept-charset="UTF-8" enctype="multipart/form-data"${attrs}>
          <input type="hidden" name="form_type" value="${this.formConfig.id}" />
          ${paramInputs.join('')}
          ${
            returnTo
              ? `<input type="hidden" name="return_to" value="${returnTo}" />`
              : ''
          }
          ${compatibilityHtml}
          ${html}
        </form>
      `;
    }
  };
}
