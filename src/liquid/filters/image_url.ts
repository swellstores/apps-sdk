import { LiquidSwell } from '..';
import { paramsToProps } from '../utils';

// {{ product | image_url: width: 450 }}

export default {
  bind(_liquidSwell: LiquidSwell) {
    return async (imageField: any, params: any[]) => {
      const image =
        imageField?.images?.[0] ||
        imageField?.image ||
        imageField?.preview_image || // Shopify specific
        imageField;

      const imageObj = await image;
      const imageSrc =
        imageObj?.url ||
        imageObj?.file?.url ||
        (await imageObj?.src)?.url || // Shopify specific
        imageObj;

      const imageUrl = String(imageSrc);

      if (typeof imageUrl !== 'string') {
        return '';
      }

      const props = paramsToProps(params);

      const query = [
        props?.width && `width=${props.width * 2}`,
        props?.height && `height=${props.height * 2}`,
      ]
        .filter(Boolean)
        .join('&');

      return `${imageUrl}${query ? `?${query}` : ''}`;
    };
  },
  resolve: [['images', 'image', 'preview_image']],
};
