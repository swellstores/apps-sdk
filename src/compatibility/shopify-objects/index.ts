import { SwellStorefrontCollection } from '../../api';
import {
  DeferredShopifyResource,
  DeferredShopifyLinkResource,
  ShopifyResource,
} from './resource';
import ShopifyArticle from './article';
import ShopifyBlog from './blog';
import ShopifyCart from './cart';
import ShopifyCollection from './collection';
import ShopifyCustomer from './customer';
import ShopifyFont from './font';
import ShopifyForm from './form';
import ShopifyOrder from './order';
import ShopifyProduct from './product';
import ShopifyPage from './page';
import ShopifyLink from './link';
import ShopifySearch from './search';
import ShopifyVariant from './variant';

export {
  DeferredShopifyResource,
  DeferredShopifyLinkResource,
  ShopifyResource,
  ShopifyArticle,
  ShopifyBlog,
  ShopifyCart,
  ShopifyCollection,
  ShopifyCustomer,
  ShopifyFont,
  ShopifyForm,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyPage,
  ShopifyLink,
  ShopifySearch,
  ShopifyVariant,
};

export function adaptShopifyMenuData(
  instance: ShopifyCompatibility,
  menu: SwellMenu,
): SwellData {
  const shopifyLinkList = {
    ...menu,
    handle: menu.id.replace(/\_/g, '-'),
    title: menu.name,
  };
  return {
    ...shopifyLinkList,
    links: menu.items?.map((item) =>
      ShopifyLink(instance, shopifyLinkList, item),
    ),
  };
}

export function adaptShopifyLookupData(
  instance: ShopifyCompatibility,
  collection: string,
  setting: ThemeSettingFieldSchema,
  value: any,
  defaultHandler: () => SwellData | null,
): SwellData | null {
  if (!setting.multi) {
    if (collection === 'categories') {
      if (value === 'all') {
        const products = new SwellStorefrontCollection(
          instance.swell as any,
          'products',
        );
        products.setCompatibilityProps(ShopifyCollection(instance, products));
        return products;
      }
    }
  }

  return defaultHandler();
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
