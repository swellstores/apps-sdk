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
import date_next_interval from './date_next_interval';
import date from './date';
import default_errors from './default_errors';
import divided_by from './divided_by';
import embedded_content from './embedded_content';
import escape from './escape';
import font_face from './font_face';
import font_modify from './font_modify';
import font_url from './font_url';
import format_address from './format_address';
import handleize from './handleize';
import image_tag from './image_tag';
import image_url from './image_url';
import inline_asset_content from './inline_asset_content';
import json from './json';
import json_pretty from './json_pretty';
import locale_flag from './locale_flag';
import minus from './minus';
import money from './money';
import money_with_currency from './money_with_currency';
import money_without_currency from './money_without_currency';
import money_without_trailing_zeros from './money_without_trailing_zeros';
import preload_tag from './preload_tag';
import script_tag from './script_tag';
import stylesheet_tag from './stylesheet_tag';
import time_tag from './time_tag';
import translate from './translate';
import where from './where';

// Shopify compatibility only
import asset_img_url from './shopify/asset_img_url';
import hex_to_rgba from './shopify/hex_to_rgba';
import img_url from './shopify/img_url';
import item_count_for_variant from './shopify/item_count_for_variant';
import payment_button from './shopify/payment_button';
import payment_terms from './shopify/payment_terms';
import placeholder_svg_tag from './shopify/placeholder_svg_tag';
import shopify_asset_url from './shopify/shopify_asset_url';
import structured_data from './shopify/structured_data';

// Swell only
import inline_editable from './inline_editable';

// Utils
import { isLikePromise, isFunction, isObject } from '../utils';

import type { LiquidSwell } from '..';
import type {
  FilterHandler,
  FilterImpl,
  FilterImplOptions,
} from 'liquidjs/dist/template';

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
  date_next_interval,
  date,
  default_errors,
  divided_by,
  embedded_content,
  escape,
  font_face,
  font_modify,
  font_url,
  format_address,
  handle: handleize, // alias
  handleize,
  image_tag,
  image_url,
  inline_asset_content,
  json,
  json_pretty,
  locale_flag,
  minus,
  money,
  money_with_currency,
  money_without_currency,
  money_without_trailing_zeros,
  preload_tag,
  script_tag,
  stylesheet_tag,
  time_tag,
  translate,
  t: translate, // alias
  where,

  // Shopify compatibility only
  asset_img_url,
  hex_to_rgba,
  img_url,
  item_count_for_variant,
  payment_button,
  payment_terms,
  placeholder_svg_tag,
  shopify_asset_url,
  structured_data,

  // Swell only
  inline_editable,
};

export function bindFilters(liquidSwell: LiquidSwell): void {
  for (const [tag, handler] of Object.entries(filters)) {
    if (typeof handler === 'function') {
      liquidSwell.registerFilter(tag, handler(liquidSwell));
    } else if (typeof handler.bind === 'function') {
      liquidSwell.registerFilter(
        tag,
        bindWithResolvedProps(liquidSwell, handler.bind, handler.resolve),
      );
    }
  }
}

// Resolve specific nested props
function bindWithResolvedProps(
  liquidSwell: LiquidSwell,
  bind: (liquidSwell: LiquidSwell) => FilterHandler,
  resolve: Array<string[] | boolean> = [],
): FilterImplOptions {
  const handler = bind(liquidSwell);
  if (!Array.isArray(resolve)) {
    return handler;
  }

  return async function (this: FilterImpl, ...props: unknown[]) {
    const [arg0, ...args] = await Promise.all(
      props.map((prop, index) => {
        if (Array.isArray(resolve[index]) || resolve[index] === true) {
          return resolveAsyncProps(prop, resolve[index]);
        }
        return prop;
      }),
    );

    return handler.call(this, arg0, ...args);
  };
}

export async function resolveAsyncProps(
  propArg: unknown,
  resolveProps: boolean | string[],
): Promise<unknown> {
  if (!propArg) {
    return propArg;
  }

  let prop = propArg as Record<string, unknown>;

  if (isLikePromise(prop)) {
    prop = (await prop) as Record<string, unknown>;
  }

  try {
    if (Array.isArray(resolveProps)) {
      for (const propPath of resolveProps) {
        if (typeof propPath !== 'string') {
          continue;
        }

        const [key, ...remainingKeys] = propPath.split('.');
        const targetProp = prop[key];

        if (isObject(targetProp)) {
          if (isLikePromise(targetProp)) {
            prop[key] = await targetProp;
          } else if (isFunction(targetProp.resolve)) {
            prop[key] = await targetProp.resolve();
          }
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
