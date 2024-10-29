import { describeFilter } from '../helpers';

describeFilter('color_to_hex', (render) => {
  it('should convert color to hex', async () => {
    const result = await render(`{{ 'rgb(234, 90, 185)' | color_to_hex }}`);

    expect(result).toBe('#ea5ab9');
  });
});
