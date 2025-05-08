import type { LiquidSwell } from '..';

import assignTag from './assign';
import caseTag from './case';
import comment from './comment';
import forTag from './for';
import form from './form';
import ifTag from './if';
import javascript from './javascript';
import layout from './layout';
import paginate from './paginate';
import render from './render';
import section from './section';
import sections from './sections';
import style from './style';
import stylesheet from './stylesheet';

// Shopify compatibility only
import include from './shopify/include';
import schema from './shopify/schema';

// Swell only
import inline_editable from './inline_editable';

export const tags = {
  assign: assignTag,
  case: caseTag,
  comment,
  for: forTag,
  form,
  if: ifTag,
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
  stylesheet,

  // Swell only
  inline_editable,
};

export function bindTags(liquidSwell: LiquidSwell): void {
  Object.entries(tags).forEach(([tag, bind]) =>
    liquidSwell.registerTag(tag, bind(liquidSwell)),
  );
}
