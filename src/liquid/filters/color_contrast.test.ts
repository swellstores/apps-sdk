import { describeFilter } from '../test-helpers';

describeFilter('color_contrast', (render) => {
  it('should return color contrast', async () => {
    const result = await render(`{{ '#E800B0' | color_contrast: '#D9D8FF' }}`);

    expect(result).toBe('3.0');
  });
});
