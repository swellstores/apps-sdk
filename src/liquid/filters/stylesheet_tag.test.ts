import { describeFilter } from '../test-helpers';

describeFilter('stylesheet_tag', (render) => {
  it('should return stylesheet tag', async () => {
    const result = await render(
      `{{ 'asset.css' | asset_url | stylesheet_tag }}`,
    );

    expect(result).toBe(
      '<link href="assets/asset.css" rel="stylesheet" type="text/css" media="all" />',
    );
  });
});
