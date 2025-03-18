import Color from 'color';

export type ColorParam =
  | Color
  | string
  | ArrayLike<number>
  | number
  | Record<string, unknown>;

export class ThemeColor {
  public color: Color;
  public colorValues: ColorParam;
  public red: number;
  public green: number;
  public blue: number;

  constructor(value: ThemeColor | string) {
    try {
      this.color = isThemeColorLike(value)
        ? typeof value.color.object === 'function' // ensure we have this required method
          ? value.color
          : Color(value.colorValues) // create a new Color otherwise
        : Color(value);
      this.colorValues = this.color.object();

      this.red = Number(this.colorValues.r);
      this.green = Number(this.colorValues.g);
      this.blue = Number(this.colorValues.b);
    } catch (_err) {
      // Just default to black in case of parse error
      this.color = Color('#000000');
      this.colorValues = this.color.object();
      this.red = Number(this.colorValues.r);
      this.green = Number(this.colorValues.g);
      this.blue = Number(this.colorValues.b);
    }
  }

  static get(value: string | ThemeColor): ThemeColor {
    return value instanceof ThemeColor ? value : new ThemeColor(value);
  }

  static clone(value: string | ThemeColor): ThemeColor {
    if (isThemeColorLike(value)) {
      return new ThemeColor(ThemeColor.get(value).toString());
    }

    return new ThemeColor(value);
  }

  toString(): string {
    return this.color.string();
  }

  lighten(percent: number): string {
    return this.color
      .lighten(percent / 100)
      .hex()
      .toLowerCase();
  }

  darken(percent: number): string {
    return this.color
      .darken(percent / 100)
      .hex()
      .toLowerCase();
  }

  rgb(): string {
    return this.color.rgb().toString();
  }

  rgba(alpha: number): string {
    return this.color.alpha(alpha).rgb().toString();
  }

  hsl(): string {
    return this.color.hsl().round().toString();
  }

  hex(): string {
    return this.color.hex().toLowerCase();
  }

  saturate(value: number): string {
    return this.color
      .saturate(value / 100)
      .hex()
      .toLowerCase();
  }

  desaturate(value: number): string {
    return this.color
      .desaturate(value / 100)
      .hex()
      .toLowerCase();
  }

  modify(field: string, value: number): string {
    switch (field) {
      case 'red':
      case 'green':
      case 'blue':
      case 'alpha':
      case 'hue':
      case 'lightness':
        break;

      case 'saturation':
        return this.color.saturationl(value).hex();

      default:
        return this.toString();
    }

    const color = this.color[field](value);

    return field === 'alpha' ? color.string() : color.hex();
  }

  extract(field: string): string {
    switch (field) {
      case 'red':
      case 'green':
      case 'blue':
      case 'alpha':
      case 'hue':
      case 'lightness':
        break;

      case 'saturation':
        return this.color.saturationl().toString();

      default:
        return this.toString();
    }

    return this.color[field]().toString();
  }

  mix(color2: ThemeColor, ratio: number): string {
    const c1 = this.color;
    const c2 = color2.color;
    const [r1, g1, b1] = c1.rgb().array();
    const [r2, g2, b2] = c2.rgb().array();

    const mixedColor = Color.rgb([
      mix(r1, r2, ratio),
      mix(g1, g2, ratio),
      mix(b1, b2, ratio),
    ]).alpha(mix(c1.alpha(), c2.alpha(), ratio));

    return c1.alpha() !== 1 ? mixedColor.string() : mixedColor.hex();
  }

  contrast(color2: ThemeColor): string {
    return this.color.contrast(color2.color).toFixed(1);
  }

  /**
   * Color perceived brightness/difference algorithms from https://www.w3.org/WAI/ER/WD-AERT/#color-contrast
   */

  difference(color2: ThemeColor): number {
    const [r1, g1, b1] = this.color.rgb().array();
    const [r2, g2, b2] = color2.color.rgb().array();
    return diff(r1, r2) + diff(g1, g2) + diff(b1, b2);
  }

  brightness(): number {
    return (this.red * 299 + this.green * 587 + this.blue * 114) / 1000;
  }

  brightnessDifference(color2: ThemeColor): number {
    return (
      Math.max(this.brightness(), color2.brightness()) -
      Math.min(this.brightness(), color2.brightness())
    );
  }
}

function mix(a: number, b: number, r: number): number {
  return (a * r + b * (100 - r)) / 100;
}

function diff(v1: number, v2: number): number {
  return Math.max(v1, v2) - Math.min(v1, v2);
}

// function brightness(colorStr: string): number {
//   const [r, g, b] = Color(colorStr).rgb().array();
//   return (r * 299 + g * 587 + b * 114) / 1000;
// }

function isThemeColorLike(value: unknown): value is ThemeColor {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, 'color') &&
    Object.hasOwn(value, 'colorValues') &&
    Object.hasOwn(value, 'red') &&
    Object.hasOwn(value, 'green') &&
    Object.hasOwn(value, 'blue')
  );
}
