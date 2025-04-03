import { describeFilter } from '../test-helpers';

describeFilter('script_tag', (render) => {
  it('should return script tag', async () => {
    const result = await render(`{{ 'main.js' | asset_url | script_tag }}`);

    expect(result).toBe(
      '<script src="assets/main.js" type="text/javascript"></script>',
    );
  });
});
