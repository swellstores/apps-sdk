import { describeFilter } from '../helpers';

describeFilter('color_to_rgb', (render) => {
  it('should convert color to rgb', async () => {
    const result = await render(`{{ '#EA5AB9' | color_to_rgb }}`);

    expect(result).toBe('rgb(234, 90, 185)');
  });

  it('should convert color to rgb with alpha channel', async () => {
    const result = await render(`{{ '#EA5AB9' | color_to_rgb: 0.5 }}`);

    expect(result).toBe('rgba(234, 90, 185, 0.5)');
  });
});
