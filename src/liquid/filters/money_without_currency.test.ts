import { describeFilter } from '../test-helpers';

describeFilter('money_without_currency', (render, liquid) => {
  it('should return money without currency', async () => {
    const result = await render(`{{ 12 USD | money_without_currency }}`);

    expect(result).toBe('12');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12);
  });
});
