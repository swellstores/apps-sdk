import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ 'cart.js' | asset_url | script_tag }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return function filterScriptTag(assetUrl: string): string {
    return `<script src="${assetUrl}" type="text/javascript"></script>`;
  };
}
