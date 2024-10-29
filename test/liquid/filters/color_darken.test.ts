import { describeFilter } from '../helpers';

describeFilter('color_darken', (render) => {
  it('should return darken color', async () => {
    const result = await render(`{{ '#EA5AB9' | color_darken: 30 }}`);

    expect(result).toBe('#c91a8d');
  });
});
