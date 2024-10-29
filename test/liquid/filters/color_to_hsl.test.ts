import { describeFilter } from '../helpers';

describeFilter('color_to_hsl', (render) => {
  it('should convert color to hsl', async () => {
    const result = await render(`{{ '#EA5AB9' | color_to_hsl }}`);

    expect(result).toBe('hsl(320, 77%, 64%)');
  });
});
