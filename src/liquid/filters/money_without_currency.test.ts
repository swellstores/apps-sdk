import { describeFilter } from '../test-helpers';

import ShopifyMoney from '../../compatibility/shopify-objects/money';

import type { ShopifyCompatibility } from '../../compatibility/shopify';

describeFilter('money_without_currency', (render, liquid) => {
  it('should format number without currency symbol', async () => {
    const result = await render(`{{ 12 USD | money_without_currency }}`);

    expect(result).toBe('12');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12);
  });

  it('should format shopify money without currency symbol', async () => {
    const instance = {
      theme: {
        globals: {
          store: {
            currency: 'USD',
            currencies: [],
          },
        },
      },
    } as unknown as ShopifyCompatibility;

    const data = {
      test_money: ShopifyMoney(instance, 12),
    };

    const result = await render(
      '{{ test_money | money_without_currency }}',
      data,
    );

    expect(result).toBe('12');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12);
  });
});
