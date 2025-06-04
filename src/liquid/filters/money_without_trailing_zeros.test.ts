import { describeFilter } from '../test-helpers';

import ShopifyMoney from '../../compatibility/shopify-objects/money';

import type { ShopifyCompatibility } from '../../compatibility/shopify';

describeFilter('money_without_trailing_zeros', (render, liquid) => {
  it('should format number without trailing zeros', async () => {
    const result = await render("{{ '12.43' | money_without_trailing_zeros }}");

    expect(result).toBe('$12');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12.43);
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
      test_money: ShopifyMoney(instance, 12.43),
    };

    const result = await render(
      '{{ test_money | money_without_trailing_zeros }}',
      data,
    );

    expect(result).toBe('$12');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12.43);
  });
});
