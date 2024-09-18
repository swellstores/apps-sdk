import { each } from 'lodash-es';
import { LiquidSwell } from '..';

import asset_url from './asset_url';
import brightness_difference from './brightness_difference';
import color_brightness from './color_brightness';
import color_contrast from './color_contrast';
import color_darken from './color_darken';
import color_desaturate from './color_desaturate';
import color_difference from './color_difference';
import color_extract from './color_extract';
import color_lighten from './color_lighten';
import color_mix from './color_mix';
import color_modify from './color_modify';
import color_saturate from './color_saturate';
import color_to_hex from './color_to_hex';
import color_to_hsl from './color_to_hsl';
import color_to_rgb from './color_to_rgb';
import date from './date';
import default_errors from './default_errors';
import font_face from './font_face';
import font_modify from './font_modify';
import font_url from './font_url';
import format_address from './format_address';
import image_tag from './image_tag';
import image_url from './image_url';
import json from './json';
import json_pretty from './json_pretty';
import money from './money';
import money_with_currency from './money_with_currency';
import money_without_currency from './money_without_currency';
import money_without_trailing_zeros from './money_without_trailing_zeros';
import stylesheet_tag from './stylesheet_tag';
import time_tag from './time_tag';
import translate from './translate';
import where from './where';

// Shopify compatibility only
import hex_to_rgba from './shopify/hex_to_rgba';
import item_count_for_variant from './shopify/item_count_for_variant';
import payment_button from './shopify/payment_button';
import payment_terms from './shopify/payment_terms';
import placeholder_svg_tag from './shopify/placeholder_svg_tag';

// Swell only

import inline_editable from './inline_editable';

export const filters = {
  asset_url,
  brightness_difference,
  color_brightness,
  color_contrast,
  color_darken,
  color_desaturate,
  color_difference,
  color_extract,
  color_lighten,
  color_mix,
  color_modify,
  color_saturate,
  color_to_hex,
  color_to_hsl,
  color_to_rgb,
  date,
  default_errors,
  font_face,
  font_modify,
  font_url,
  format_address,
  image_tag,
  image_url,
  json,
  json_pretty,
  money,
  money_with_currency,
  money_without_currency,
  money_without_trailing_zeros,
  stylesheet_tag,
  time_tag,
  translate,
  t: translate, // alias
  where,

  // Shopify compatibility only
  hex_to_rgba,
  item_count_for_variant,
  payment_button,
  payment_terms,
  placeholder_svg_tag,

  // Swell only
  inline_editable,
};

export function bindFilters(liquidSwell: LiquidSwell) {
  each(filters, (handler, tag) => {
    if (typeof handler === 'function') {
      liquidSwell.engine.registerFilter(tag, handler(liquidSwell));
    } else if (typeof handler.bind === 'function') {
      const { bind, resolve } = handler;
      liquidSwell.engine.registerFilter(
        tag,
        bindWithResolvedProps(liquidSwell, bind, resolve),
      );
    }
  });
}

// Resolve specific nested props
function bindWithResolvedProps(
  liquidSwell: LiquidSwell,
  bind: (liquidSwell: LiquidSwell) => any,
  resolve: Array<Array<string> | boolean> = [],
) {
  const handler = bind(liquidSwell);
  if (!Array.isArray(resolve)) {
    return handler;
  }

  return async (...props: any[]) => {
    const resolvedProps = await Promise.all(
      props.map((prop, index) => {
        if (Array.isArray(resolve[index]) || resolve[index] === true) {
          return resolveAsyncProps(prop, resolve[index]);
        }
        return prop;
      }),
    );
    return handler(...resolvedProps);
  };
}

export async function resolveAsyncProps(
  propArg: any,
  resolveProps: boolean | Array<string>,
): Promise<any> {
  if (!propArg) {
    return propArg;
  }

  let prop = propArg;

  if (prop instanceof Promise) {
    prop = await prop;
  }

  try {
    if (Array.isArray(resolveProps)) {
      for (const propPath of resolveProps) {
        if (typeof propPath !== 'string') {
          continue;
        }

        const [key, ...remainingKeys] = propPath.split('.');
        const targetProp = prop[key];

        if (targetProp instanceof Promise) {
          prop[key] = await targetProp;
        } else if (typeof targetProp?.resolve === 'function') {
          prop[key] = await targetProp.resolve();
        }

        if (remainingKeys.length > 0) {
          prop[key] = await resolveAsyncProps(prop[key], [
            remainingKeys.join('.'),
          ]);
        }
      }
    }
  } catch {
    // noop
  }

  return prop;
}
