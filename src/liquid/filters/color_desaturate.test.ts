import { describeFilter } from '../test-helpers';

describeFilter('color_desaturate', (render) => {
  it('should desaturate color', async () => {
    const result = await render(`{{ '#EA5AB9' | color_desaturate: 30 }}`);

    expect(result).toBe('#d470b2');
  });
});
