import { Liquid, Tag, TagToken, Context } from 'liquidjs';

import { LiquidSwell } from '..';

import type { TopLevelToken } from 'liquidjs';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass } from 'liquidjs/dist/template';
import type { ThemeSectionConfig } from 'types/swell';

// {% sections 'section-group' %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class SectionsTag extends Tag {
    private fileName: string;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
    ) {
      super(token, remainTokens, liquid);
      const { tokenizer } = token;
      this.fileName = (tokenizer.readValue() as QuotedToken)?.content;
    }

    *render(_ctx: Context): any {
      const filePath = yield liquidSwell.getSectionGroupPath(this.fileName);
      const themeConfig = yield liquidSwell.getThemeConfig(filePath);

      try {
        const sectionGroup = JSON.parse(themeConfig.file_data);
        const sectionConfigs =
          yield liquidSwell.renderPageSections(sectionGroup);
        const { shopify_compatibility: shopifyCompatibility } =
          liquidSwell.theme.globals;

        return `<div id="swell-section-group__${this.fileName}">${sectionConfigs
          .map((section: ThemeSectionConfig) => {
            const id = `${shopifyCompatibility ? 'shopify' : 'swell'}-section-sections--${themeConfig.hash}__${section.id}`;
            const className = shopifyCompatibility
              ? `shopify-section shopify-section-group-${this.fileName} section-${section.id}`
              : `swell-section swell-section-group-${this.fileName} section-${section.id}`;

            return `<${section.tag} id="${id}" class="${className} ${section.class || ''}">${
              section.output
            }</${section.tag}>`;
          })
          .join('')}</div>`;
      } catch (_err) {
        return '';
      }
    }
  };
}
