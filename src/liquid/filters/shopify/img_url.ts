import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '../..';

interface ImgSrcObject {
  url: string;
  width?: number;
  height?: number;
}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterImgUrl(
    input: string | ImgSrcObject,
    ...params: string[]
  ): string {
    if (!input) return '';

    let url: string;

    if (typeof input === 'object') {
      if (input.url) {
        url = input.url;
      } else {
        return '';
      }
    } else {
      url = String(input);
    }

    const query: string[] = [];

    params.forEach((param) => {
      if (!param) {
        return;
      }

      const [key, value] = param.includes(':')
        ? param.split(':').map((s) => s.trim())
        : [param, undefined];

      if (/^w\d+$/.test(key)) {
        query.push(`width=${key.slice(1)}`);
      } else if (/^h\d+$/.test(key)) {
        query.push(`height=${key.slice(1)}`);
      } else if (key === 'crop' && value) {
        query.push(`crop=${encodeURIComponent(value)}`);
      }
    });

    return query.length ? `${url}?${query.join('&')}` : url;
  };
}
