import { LiquidSwell } from '..';
import { isNumber } from '../utils';

/*
  {{ 4 | divided_by: 2 }}

  divisor is an integer
  {{ 20 | divided_by: 7 }}

  divisor is a float
  {{ 20 | divided_by: 7.0 }}

  with `integerArithmetic` argument to enforce integer divide
  {{ 5 | divided_by: 3, true }}
*/

export default function bind(_liquidSwell: LiquidSwell) {
  return (dividend: number, divisor: number, integerArithmetic: boolean) => {
    if (!isNumber(dividend) || !isNumber(divisor)) {
      return dividend;
    }

    return integerArithmetic
      ? Math.floor(dividend / divisor)
      : dividend / divisor;
  };
}
