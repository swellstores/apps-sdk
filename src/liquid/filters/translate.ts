import { LiquidSwell } from '..';
import { paramsToProps } from '../utils';

// {{ 'translation.key' | t: prop: value }}

export default function bind(liquidSwell: LiquidSwell) {
  return async (key: string, params?: any[]) => {
    const props = params && paramsToProps(params);
    return await liquidSwell.renderTranslation(key, props);
  };
}
