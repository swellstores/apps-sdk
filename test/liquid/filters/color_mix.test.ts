import { describeFilter } from '../helpers';

describeFilter('color_mix', (render) => {
  it('should mix color', async () => {
    const result = await render(`{{ '#E800B0' | color_mix: '#00936F', 50 }}`);

    expect(result).toBe('#744A90');
  });

  it('should mix color with alpha channel', async () => {
    const result = await render(
      `{{ 'rgba(232, 0, 176, 0.75)' | color_mix: '#00936F', 50 }}`,
    );

    expect(result).toBe('rgba(116, 74, 144, 0.875)');
  });
});
