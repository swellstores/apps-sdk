import { each } from 'lodash-es';
import { LiquidSwell } from '..';

import { default as caseTag } from './case';
import { default as forTag } from './for';
import form from './form';
import javascript from './javascript';
import layout from './layout';
import paginate from './paginate';
import render from './render';
import section from './section';
import sections from './sections';
import style from './style';

// Shopify compatibility only
import include from './shopify/include';
import schema from './shopify/schema';

// Swell only
import inline_editable from './inline_editable';

export const tags = {
  case: caseTag,
  for: forTag,
  form,
  javascript,
  layout,
  paginate,
  render,
  section,
  sections,
  style,

  // Shopify compatibility only
  include,
  schema,

  // Swell only
  inline_editable,
};

export function bindTags(liquidSwell: LiquidSwell) {
  each(tags, (bind, tag) =>
    liquidSwell.engine.registerTag(tag, bind(liquidSwell)),
  );
}
