import { LiquidSwell } from '..';

// {{ product.price | money_with_currency }}

export default function bind(liquidSwell: LiquidSwell) {
  return (value: number) => {
    const { currency } = liquidSwell.theme.swell.getStorefrontLocalization();

    return `${liquidSwell.renderCurrency(value)} ${currency?.toUpperCase()}`;
  };
}
