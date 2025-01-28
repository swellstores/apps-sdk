import { describeFilter } from '../test-helpers';

describeFilter('color_difference', (render) => {
  it('should return color difference', async () => {
    const result = await render(
      `{{ '#720955' | color_difference: '#FFF3F9' }}`,
    );

    expect(result).toBe('539');
  });
});
