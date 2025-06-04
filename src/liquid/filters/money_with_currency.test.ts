import { describeFilter } from '../test-helpers';

import ShopifyMoney from '../../compatibility/shopify-objects/money';

import type { ShopifyCompatibility } from '../../compatibility/shopify';

describeFilter('money_with_currency', (render, liquid) => {
  it('should format number with currency code', async () => {
    const result = await render('{{ 12 | money_with_currency }}');

    expect(result).toBe('$12 USD');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12);
  });

  it('should format shopify money with currency code', async () => {
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

    const result = await render('{{ test_money | money_with_currency }}', data);

    expect(result).toBe('$12 USD');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12);
  });
});
