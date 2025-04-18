import { type LiquidSwell, ThemeColor } from '..';

import type { FilterHandler } from 'liquidjs/dist/template';

// {{ '#EA5AB9' | color_modify: 'red', 255 }} => #ff5ab9
// {{ '#EA5AB9' | color_modify: 'alpha', 0.85 }} => rgba(234, 90, 185, 0.85)

type ColorField =
  | 'red'
  | 'green'
  | 'blue'
  | 'alpha'
  | 'hue'
  | 'saturation'
  | 'lightness';

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterColorModify(
    color: string | ThemeColor,
    field: ColorField,
    value: unknown,
  ): string {
    return ThemeColor.get(color).modify(field, Number(value) || 0);
  };
}
