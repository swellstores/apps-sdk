import { describeFilter } from '../helpers';

describeFilter('asset_url', (render, liquid) => {
  it('should return asset url', async () => {
    const result = await render(`{{ 'asset.css' | asset_url }}`);

    expect(result).toBe('assets/asset.css');
    expect(liquid.getAssetUrl).toHaveBeenCalledWith('asset.css');
  });
});
