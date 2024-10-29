import { describeFilter } from '../helpers';

describeFilter('brightness_difference', (render) => {
  it('should return brightness difference', async () => {
    const result = await render(
      `{{ '#E800B0' | brightness_difference: '#FECEE9' }}`,
    );

    expect(result).toBe('133.998');
  });
});
