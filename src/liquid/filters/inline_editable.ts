import { LiquidSwell } from '..';
import { paramsToProps } from '../utils';

// {{ block.settings.heading | inline_editable: 'heading' }}

export default function bind(_liquidSwell: LiquidSwell) {
  return (value: string | { value: string }, key?: string) => {
    if (typeof value === 'object' && 'value' in value) {
      value = value.value;
    }
    return `<span data-swell-inline-editable="${key}">${value}</span>`;
  };
}
