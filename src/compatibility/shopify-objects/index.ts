import type { ShopifyCompatibility } from '@/compatibility/shopify';
import type { ThemeFont } from '@/liquid/font';
import type { ThemeForm } from '@/liquid/form';

import ShopifyArticle from './article';
import ShopifyBlog from './blog';
import ShopifyCart from './cart';
import ShopifyCollection from './collection';
import ShopifyCollections from './collections';
import ShopifyCustomer from './customer';
import ShopifyFont from './font';
import ShopifyForm from './form';
import ShopifyLink from './link';
import ShopifyLocalization from './localization';
import ShopifyOrder from './order';
import ShopifyPaginate from './paginate';
import ShopifyPredictiveSearch from './predictive_search';
import ShopifyProduct from './product';
import ShopifyRecommendations from './recommendations';
import ShopifyPage from './page';
import { DeferredShopifyResource, ShopifyResource } from './resource';
import ShopifySearch from './search';
import ShopifyVariant from './variant';

import type { SwellMenu, SwellData } from '../../../types/swell';

export {
  DeferredShopifyResource,
  ShopifyResource,
  ShopifyArticle,
  ShopifyBlog,
  ShopifyCart,
  ShopifyCollection,
  ShopifyCollections,
  ShopifyCustomer,
  ShopifyFont,
  ShopifyForm,
  ShopifyOrder,
  ShopifyPaginate,
  ShopifyPredictiveSearch,
  ShopifyProduct,
  ShopifyRecommendations,
  ShopifyPage,
  ShopifyLink,
  ShopifyLocalization,
  ShopifySearch,
  ShopifyVariant,
};

export function adaptShopifyMenuData(
  instance: ShopifyCompatibility,
  menu: SwellMenu,
): SwellData {
  const shopifyLinkList = {
    ...menu,
    handle: menu.id.replace(/_/g, '-'),
    title: menu.name,
  };
  return {
    ...shopifyLinkList,
    links: menu.items?.map((item) =>
      ShopifyLink(instance, shopifyLinkList, item),
    ),
  };
}

export function adaptShopifyFontData(
  instance: ShopifyCompatibility,
  font: ThemeFont,
): SwellData {
  return ShopifyFont(instance, font);
}

export function adaptShopifyFormData(
  instance: ShopifyCompatibility,
  form: ThemeForm,
): SwellData {
  return ShopifyForm(instance, form);
}
