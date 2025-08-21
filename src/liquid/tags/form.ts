import { Tag, Hash, TypeGuards, evalToken } from 'liquidjs';

import { ThemeForm } from '../form';

import type { LiquidSwell } from '..';
import type {
  Liquid,
  TagToken,
  Parser,
  Context,
  Emitter,
  Template,
  TopLevelToken,
  ValueToken,
} from 'liquidjs';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';
import type { ThemeFormConfig } from 'types/swell';

// {% form 'form_type' %}
// {% form 'form_type', param %}
// {% form 'form_type', return_to: 'url %}

const IGNORED_SHOPIFY_FORMS = Object.freeze(['new_comment', 'guest_login']);

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class FormTag extends Tag {
    private formType: string;
    private formConfig?: ThemeFormConfig;
    private templates: Template[];
    private hash: Hash;
    private arg?: ValueToken;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      parser: Parser,
    ) {
      super(token, remainTokens, liquid);

      const { tokenizer } = token;
      this.formType = (tokenizer.readValue() as QuotedToken)?.content;
      this.formConfig = liquidSwell.theme.getFormConfig(this.formType);

      tokenizer.advance();

      this.arg = tokenizer.readValue();
      this.templates = [];
      this.hash = new Hash(this.tokenizer.remaining());

      while (remainTokens.length > 0) {
        const token = remainTokens.shift() as TopLevelToken;

        if (TypeGuards.isTagToken(token) && token.name === 'endform') {
          return;
        }

        this.templates.push(parser.parseToken(token, remainTokens));
      }

      if (!this.formConfig && !IGNORED_SHOPIFY_FORMS.includes(this.formType)) {
        return;
      }

      throw new Error(`tag ${token.getText()} not closed`);
    }

    *render(ctx: Context, emitter: Emitter): TagRenderReturn {
      if (!this.formConfig) {
        emitter.write(
          `<!-- form '${this.formType}' not found in theme configuration -->`,
        );
        return;
      }

      const r = this.liquid.renderer;
      const arg: unknown = yield evalToken(this.arg, ctx);
      const hash = yield this.hash.render(ctx);

      const scope = ctx.getAll();

      const attrs =
        ' ' +
        Object.entries(hash)
          .reduce((acc: string[], [key, value]: [string, unknown]) => {
            if (value !== true) {
              // true represents the form type
              acc.push(`${key}="${String(value)}"`);
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
          compatibilityHtml =
            yield liquidSwell.renderTemplateString(compatibilityOutput);
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

      const paramInputs: string[] = Array.isArray(this.formConfig.params)
        ? yield Promise.all(
            this.formConfig.params.map(async (param) => {
              const value = await liquidSwell.renderTemplateString(
                param.value,
                { value: arg },
              );

              return `<input type="hidden" name="${param.name}" value="${value}" />`;
            }),
          )
        : [];

      const returnTo =
        hash.return_to || liquidSwell.theme.globals.request?.path;

      emitter.write(`
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
      `);

      ctx.pop();
    }
  };
}
