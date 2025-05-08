import { paramsToProps } from '../utils';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ 'translation.key' | t: prop: value }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return async function filterTranslate(
    key: string,
    params?: string[],
  ): Promise<string> {
    const props = params && paramsToProps(params);
    const str = await liquidSwell.renderTranslation(key, props);
    return str.replace(/(?!\\)"/g, '&#34;').replace(/(?!\\)'/g, '&#39;');
  };
}
