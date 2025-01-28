import { describeFilter } from '../test-helpers';

describeFilter('color_extract', (render) => {
  it('should return extract color', async () => {
    const result = await render(`{{ '#EA5AB9' | color_extract: 'red' }}`);

    expect(result).toBe('234');
  });
});
