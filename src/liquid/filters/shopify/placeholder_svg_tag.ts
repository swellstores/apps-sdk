import placeholderSvgs from './placeholder-svgs';

import type { LiquidSwell } from '../..';
import type { FilterHandler } from 'liquidjs/dist/template';

// {{ 'image' | placeholder_svg_tag }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterPlaceholderSvgTag(
    name: string,
    className: string,
  ): string {
    const svg = placeholderSvgs[name];

    if (typeof svg === 'object' && svg !== null) {
      return `<img src="${svg.src}" alt="${name}"${className ? ` class="${className}"` : ''} />`;
    }

    // TODO: add className to svg
    return svg || name;
  };
}
