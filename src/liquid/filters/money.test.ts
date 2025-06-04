import { describeFilter } from '../test-helpers';

import ShopifyMoney from '../../compatibility/shopify-objects/money';

import type { ShopifyCompatibility } from '../../compatibility/shopify';

describeFilter('money', (render, liquid) => {
  it('should format number', async () => {
    const result = await render('{{ 12.43 | money }}');

    expect(result).toBe('$12.43');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12.43);
  });

  it('should format shopify money', async () => {
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
      test_money: ShopifyMoney(instance, 12.43),
    };

    const result = await render('{{ test_money | money }}', data);

    expect(result).toBe('$12.43');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12.43);
  });
});
