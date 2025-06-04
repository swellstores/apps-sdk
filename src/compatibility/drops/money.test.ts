import { describeFilter } from '../../liquid/test-helpers';

import MoneyDrop from './money';

describeFilter('compatibility/drops/money', (render) => {
  it('should render money drop', async () => {
    const data = {
      test_money: new MoneyDrop(11, 2, {
        iso_code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      }),
    };

    const result = await render('{{ test_money }}', data);

    expect(result).toStrictEqual('1100');
  });
});
