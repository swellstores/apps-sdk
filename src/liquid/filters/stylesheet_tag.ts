import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ 'asset.css' | asset_url | stylesheet_tag }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterStyleSheetTag(assetUrl: string): string {
    return `<link href="${assetUrl}" rel="stylesheet" type="text/css" media="all" />`;
  };
}
