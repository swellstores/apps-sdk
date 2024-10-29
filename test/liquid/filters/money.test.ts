import { describeFilter } from '../helpers';

describeFilter('money', (render, liquid) => {
  it('should return money', async () => {
    const result = await render(`{{ 12.43 | money }}`);

    expect(result).toBe('$12.43');
    expect(liquid.renderCurrency).toHaveBeenCalledWith(12.43);
  });
});
