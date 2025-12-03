import { paramsToProps } from '../utils';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ 'asset.css' | asset_url | preload_tag }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterPreloadTag(assetUrl: string, ...params: any[]): string {
    if (!assetUrl) {
      return '';
    }

    const { as } = paramsToProps(params);

    let attributes = '';
    if (typeof as === 'string' && as) {
      attributes += `as="${as}"`;
    }

    return `<link href="${assetUrl}" rel="preload" ${attributes} />`;
  };
}
