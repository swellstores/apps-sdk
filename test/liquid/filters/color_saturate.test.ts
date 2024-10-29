import { describeFilter } from '../helpers';

describeFilter('color_saturate', (render) => {
  it('should saturate color', async () => {
    const result = await render(`{{ '#EA5AB9' | color_saturate: 30 }}`);

    expect(result).toBe('#ff44c0');
  });
});
