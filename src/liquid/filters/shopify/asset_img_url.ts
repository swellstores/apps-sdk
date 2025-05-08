import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '../..';

// {{ 'image.jpg' | asset_img_url: 'large' }}

interface AssetImageSize {
  width?: number;
  height?: number;
}

function getSizesFromParam(param: string): AssetImageSize {
  switch (param) {
    case 'pico':
      return { width: 16, height: 16 };
    case 'icon':
      return { width: 32, height: 32 };
    case 'thumb':
      return { width: 50, height: 50 };
    case 'small':
      return { width: 100, height: 100 };
    case 'compact':
      return { width: 160, height: 160 };
    case 'medium':
      return { width: 240, height: 240 };
    case 'large':
      return { width: 480, height: 480 };
    case 'grande':
      return { width: 600, height: 600 };
    case 'original':
    case 'master':
      return { width: 1024, height: 1024 };
    default:
      break;
  }

  const [width, height] = param.split('x');

  return {
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
  };
}

export default function bind(liquidSwell: LiquidSwell): FilterHandler {
  return async function filterAssetImgUrl(
    assetPath: string,
    size: string = 'small',
  ): Promise<string> {
    const imageUrl = await liquidSwell
      .getAssetUrl(assetPath)
      .then((url) => url || '');

    const sizes = getSizesFromParam(size);
    const query = [];

    if (sizes.width) {
      query.push(`width=${sizes.width}`);
    }

    if (sizes.height) {
      query.push(`height=${sizes.height}`);
    }

    return query.length > 0 ? `${imageUrl}?${query.join('&')}` : imageUrl;
  };
}
