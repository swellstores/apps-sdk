import {
  SwellStorefrontRecord,
  SwellStorefrontCollection,
  StorefrontResource,
} from '../../api';
import { ShopifyCompatibility } from '../shopify';
import {
  DeferredShopifyResource,
  DeferredShopifyLinkResource,
  ShopifyResource,
} from './resource';
import ShopifyArticle from './article';
import ShopifyBlog from './blog';
import ShopifyCart from './cart';
import ShopifyCollection from './collection';
import ShopifyCollections from './collections';
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
  ShopifyCollections,
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
  if (!setting.multiple) {
    if (collection === 'categories') {
      if (value === 'all') {
        // TODO: remove this once backend for "all" is done
        const category = new AllCategoryResource(instance.swell);
        category.setCompatibilityProps(
          ShopifyCollection(instance, category as StorefrontResource),
        );
        return category;
      }
    }
  }

  return defaultHandler();
}

// TODO: remove this once backend is implemented for "all"
class AllCategoryResource extends SwellStorefrontRecord {
  constructor(swell: Swell) {
    super(swell, 'categories', 'all', {}, async () => {
      const category = {
        id: 'all',
        slug: 'all',
        name: 'Products',
        products: new SwellStorefrontCollection(swell, 'products'),
      } as any;

      const products = new SwellStorefrontCollection(swell, 'products');

      await products.results;

      category.products = {
        results: products.results,
        count: products.count,
        limit: products.limit,
        pages: products.pages,
        page: products.page,
        page_count: products.page_count,
      };

      return category;
    });
  }
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
