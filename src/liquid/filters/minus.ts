import { LiquidSwell } from '..';
import { isNumber } from '../utils';

export default function bind(_liquidSwell: LiquidSwell) {
  return (first: number, second: number) => {
    const firstValue = isNumber(first) ? first : 0;
    const secondValue = isNumber(second) ? second : 0;

    return firstValue - secondValue;
  };
}
