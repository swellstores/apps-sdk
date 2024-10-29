import { describeFilter } from '../helpers';

describeFilter('money_without_trailing_zeros', (render, liquid) => {
  it('should return money without trailing zeros', async () => {
    const result = await render(`{{ '12.43' | money_without_trailing_zeros }}`);

    expect(result).toBe('$12');
    expect(liquid.renderCurrency).toHaveBeenCalledWith('12.43');
  });
});
