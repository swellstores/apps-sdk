import { describeFilter } from '../helpers';

describeFilter('color_brightness', (render) => {
  it('should return color brightness', async () => {
    const result = await render(`{{ '#EA5AB9' | color_brightness }}`);

    expect(result).toBe('143.886');
  });
});
