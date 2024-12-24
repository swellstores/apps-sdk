import { LiquidSwell } from '..';

// {{ 'icon.svg' | inline_asset_content }}

export default function bind(liquidSwell: LiquidSwell) {
  return async (assetPath: string) => {
    const config = await liquidSwell.theme.getThemeConfig(
      `theme/assets/${assetPath}`,
    );
    return config?.file_data || '';
  };
}
