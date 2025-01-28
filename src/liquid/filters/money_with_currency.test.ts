import { describeFilter } from '../test-helpers';

describeFilter('money_with_currency', (render, liquid) => {
  it('should return money with currency', async () => {
    const result = await render(`{{ 12 | money_with_currency }}`);

    expect(result).toBe('$12 USD');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12);
  });
});
