import { LiquidSwell, ThemeColor } from '..';

// {{ '#EA5AB9' | color_lighten: 30 }} => #f5b0de

export default function bind(_liquidSwell: LiquidSwell) {
  return (color: string | ThemeColor, percent: number): string => {
    return ThemeColor.get(color).lighten(percent);
  };
}
