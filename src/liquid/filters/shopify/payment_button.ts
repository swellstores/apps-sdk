import { LiquidSwell } from '../..';

// {{ form | payment_button }}

export default function bind(_liquidSwell: LiquidSwell) {
  return (form: any) => {
    // TODO
    return `<button style="display: block; visibility: hidden;"></button>`;
  };
}
