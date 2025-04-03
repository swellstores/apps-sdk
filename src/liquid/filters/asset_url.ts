import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ 'asset.css' | asset_url }}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return function filterAssetUrl(assetPath: string): Promise<string> {
    return liquidSwell.getAssetUrl(assetPath).then((url) => url || '');
  };
}
