import { Tag } from 'liquidjs';
import JSON5 from 'json5';

import type { LiquidSwell } from '..';
import type {
  SwellThemeConfig,
  ThemeSectionConfig,
  ThemeSectionGroup,
} from 'types/swell';
import type {
  Liquid,
  TagToken,
  Context,
  Parser,
  TopLevelToken,
  Emitter,
} from 'liquidjs';
import type { QuotedToken } from 'liquidjs/dist/tokens';
import type { TagClass, TagRenderReturn } from 'liquidjs/dist/template';

// {% sections 'section-group' %}

export default function bind(liquidSwell: LiquidSwell): TagClass {
  return class SectionsTag extends Tag {
    private fileName: string;

    constructor(
      token: TagToken,
      remainTokens: TopLevelToken[],
      liquid: Liquid,
      _parser: Parser,
    ) {
      super(token, remainTokens, liquid);
      const { tokenizer } = token;
      this.fileName = (tokenizer.readValue() as QuotedToken)?.content;
    }

    *render(_ctx: Context, emitter: Emitter): TagRenderReturn {
      const filePath = (yield liquidSwell.getSectionGroupPath(
        this.fileName,
      )) as string;

      const themeConfig = (yield liquidSwell.getThemeConfig(
        filePath,
      )) as SwellThemeConfig;

      try {
        const sectionGroup = JSON5.parse<ThemeSectionGroup>(
          themeConfig.file_data,
        );

        const sectionConfigs = (yield liquidSwell.renderPageSections(
          sectionGroup,
        )) as ThemeSectionConfig[];

        const { shopify_compatibility: shopifyCompatibility } =
          liquidSwell.theme.globals;

        const sectionClassName =
          liquidSwell.theme.getSectionClassName(!!shopifyCompatibility);
        const sectionIdPrefix =
          liquidSwell.theme.getSectionIdPrefix(!!shopifyCompatibility);

        emitter.write(
          `<div id="swell-section-group__${this.fileName}">${sectionConfigs
            .map((section) => {
              const tag = section.tag || 'div';

              const id = `${sectionIdPrefix}-sections--${themeConfig.hash}__${section.id}`;

              const className = `${sectionClassName} ${sectionClassName}-group-${this.fileName} section-${section.id}`;

              return `<${tag} id="${id}" class="${className} ${section.class || ''}">${
                section.output
              }</${tag}>`;
            })
            .join('')}</div>`,
        );

        yield liquidSwell.theme.addPageSection(this.fileName, true);
      } catch (err) {
        // noop
        console.warn(err);
      }
    }
  };
}
