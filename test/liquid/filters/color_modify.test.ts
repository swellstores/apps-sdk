import { describeFilter } from '../helpers';

describeFilter('color_modify', (render) => {
  it('should modify color', async () => {
    const result = await render(`{{ '#EA5AB9' | color_modify: 'red', 255 }}`);

    expect(result).toBe('#FF5AB9');
  });

  it('should modify color with alpha channel', async () => {
    const result = await render(
      `{{ '#EA5AB9' | color_modify: 'alpha', 0.85 }}`,
    );

    expect(result).toBe('rgba(234, 90, 185, 0.85)');
  });
});
