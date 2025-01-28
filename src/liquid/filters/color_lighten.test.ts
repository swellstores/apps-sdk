import { describeFilter } from '../test-helpers';

describeFilter('color_lighten', (render) => {
  it('should return lighten color', async () => {
    const result = await render(`{{ '#EA5AB9' | color_lighten: 30 }}`);

    expect(result).toBe('#f5b0de');
  });
});
