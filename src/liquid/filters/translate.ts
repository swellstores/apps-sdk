import { paramsToProps } from '../utils';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ 'translation.key' | t: prop: value }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return async function filterTranslate(
    key: string,
    params?: any[],
  ): Promise<string> {
    const props = params && paramsToProps(params);
    return await liquidSwell.renderTranslation(key, props);
  };
}
