import { paramsToProps } from '../utils';

import type { LiquidSwell } from '..';
import type { FilterHandler } from 'liquidjs/dist/template';

// {{ product | image_url | image_tag }}
// TODO: focal point

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterImageTag(imageUrl: string, ...params: any[]): string {
    imageUrl = String(imageUrl || '');

    let {
      width,
      height,
      widths,
      srcset,
      preload,
      alt,
      loading = 'lazy',
      ...attrs
    } = paramsToProps(params);

    if (width === undefined) {
      width = getSizeFromUrlQuery(imageUrl, 'width');
    }

    if (height === undefined) {
      height = getSizeFromUrlQuery(imageUrl, 'height');
    }

    if (widths === undefined && typeof width === 'number') {
      widths = generateSmartWidths(width);
    }

    if (srcset === undefined && Array.isArray(widths) && widths.length > 0) {
      srcset = generateSmartSrcset(imageUrl, widths);
    }

    if (loading === null) {
      loading = undefined;
    } else if (preload) {
      loading = 'eager';
    }

    const imgAttrs = {
      src: imageUrl,
      width,
      height,
      srcset,
      alt,
      loading,
      ...attrs,
    };

    return `<img ${Object.entries(imgAttrs)
      .reduce((acc: string[], [key, value]) => {
        if (value !== undefined && value !== null) {
          acc.push(`${key}="${String(value)}"`);
        }

        return acc;
      }, [])
      .join(' ')} />`;
  };
}

function makeRegexForParam(param: string): RegExp {
  switch (param) {
    case 'width':
      return /width=(\d+)/;
    case 'height':
      return /height=(\d+)/;
    default:
      return new RegExp(`${param}=(\\d+)`);
  }
}

function getSizeFromUrlQuery(imageUrl: string, param: string): number | null {
  const regex = makeRegexForParam(param);
  const match = imageUrl.match(regex);

  if (match !== null) {
    return parseInt(match[1]) / 2; // divide by 2 for retina
  }

  return null;
}

function generateSmartWidths(width: number): number[] {
  // TODO: see if this actually makes sense
  const widths: number[] = [];

  while (width > 256) {
    width = Math.round(width * 0.8);
    widths.push(width);
  }

  return widths;
}

function generateSmartSrcset(imageUrl: string, widths: number[]): string {
  return widths
    .map((w) => {
      let url = imageUrl;

      if (url.includes('?')) {
        url = url.replace(/width=\d+/, `width=${w}`).replace(/height=\d+/, '');
      } else {
        url = `${url}?width=${w}`;
      }

      return `${url} ${w}w`;
    })
    .join(', ');
}
