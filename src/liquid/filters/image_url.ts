import { isLikePromise, paramsToProps } from '../utils';
import { getCountryCodeFromLocale, isLikeSwellLocale, isObject } from '@/utils';
import { isLikeShopifyCountry } from '@/compatibility/shopify-objects/localization';

import type { LiquidSwell } from '..';
import type { FilterHandler } from 'liquidjs/dist/template';

// {{ product | image_url: width: 450 }} or {{ product | image_url: width: 450, height: 300 }}

// eslint-disable-next-line @typescript-eslint/require-await
async function getImageObjectFromInput(input: unknown): Promise<unknown> {
  if (isObject(input)) {
    if (Array.isArray(input.images) && input.images.length > 0) {
      return input.images[0];
    }

    return (
      input.image ||
      // Shopify specific
      input.preview_image ||
      ''
    );
  }

  return input;
}

async function getImageSrcFromObject(input: unknown): Promise<unknown> {
  if (isObject(input)) {
    if (input.url) {
      return input.url;
    }

    if (isObject(input.file)) {
      return input.file.url;
    }

    if (isLikePromise(input.src)) {
      // Shopify specific
      const image = await input.src;
      return isObject(image) ? image.url : '';
    }

    return '';
  }

  return input;
}

function getCountryFlagUrl(countryIsoCode: string): string {
  return `https://cdnjs.cloudflare.com/ajax/libs/flag-icons/7.3.2/flags/1x1/${countryIsoCode.toLowerCase()}.svg`;
}

async function getImageUrlFromInput(
  input: unknown,
  liquidSwell: LiquidSwell,
): Promise<unknown> {
  if (isLikeSwellLocale(input)) {
    const code = getCountryCodeFromLocale(input.code);

    if (code) {
      return getCountryFlagUrl(code);
    }

    return '';
  }

  if (liquidSwell.theme.shopifyCompatibility && isLikeShopifyCountry(input)) {
    if (input.iso_code) {
      return getCountryFlagUrl(input.iso_code);
    }

    return '';
  }

  const imageSrc = await getImageObjectFromInput(input).then(
    getImageSrcFromObject,
  );

  return imageSrc;
}

const filterDefinition = {
  bind(liquidSwell: LiquidSwell): FilterHandler {
    return async function filterImageUrl(
      input: unknown,
      ...params: string[]
    ): Promise<string> {
      const imageUrl = await getImageUrlFromInput(input, liquidSwell);

      if (typeof imageUrl !== 'string' || imageUrl === '') {
        return '';
      }

      const props = paramsToProps(params);
      const query: string[] = [];

      if (props.width) {
        query.push(`width=${Number(props.width) * 2}`);
      }

      if (props.height) {
        query.push(`height=${Number(props.height) * 2}`);
      }

      return query.length > 0 ? `${imageUrl}?${query.join('&')}` : imageUrl;
    };
  },
  resolve: [['images', 'image', 'preview_image']],
};

export default filterDefinition;
