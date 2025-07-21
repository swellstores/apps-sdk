import { get } from 'lodash-es';

import { SwellTheme } from './theme';
import { SwellStorefrontRecord, SwellStorefrontCollection } from './api';
import { arrayToObject } from './utils';

import {
  SwellMenuItemType,
  type SwellMenu,
  type SwellMenuItem,
} from '../types/swell';

export async function resolveMenuSettings(
  theme: SwellTheme,
  menus: SwellMenu[],
  options?: { currentUrl?: string },
): Promise<Record<string, SwellMenu | undefined>> {
  const resolvedMenus = await Promise.all(
    menus?.map(async (menu): Promise<SwellMenu> => {
      const item: SwellMenu = {
        ...menu,
        items: await resolveMenuItems(theme, menu.items, options),
      };

      return item;
    }),
  );

  const compatibleMenus =
    resolvedMenus.map((menu) => {
      if (theme.shopifyCompatibility) {
        Object.assign(menu, theme.shopifyCompatibility.getMenuData(menu));
      }
      return menu;
      // todo set handle-based menu ids if set
    }) || [];

  return arrayToObject<SwellMenu>([
    ...compatibleMenus,
    // Add menus with id as handle for shopify compatibility
    ...(theme.shopifyCompatibility
      ? compatibleMenus.reduce<SwellMenu[]>((acc, menu) => {
          if (menu.handle) {
            acc.push({
              ...menu,
              id: menu.handle,
            });
          }

          return acc;
        }, [])
      : []),
  ]);
}

export async function resolveMenuItems(
  theme: SwellTheme,
  menuItems: SwellMenuItem[],
  options?: { currentUrl?: string },
): Promise<SwellMenuItem[]> {
  const hasMenuItems = menuItems?.length > 0;

  if (!hasMenuItems) {
    return [];
  }

  return Promise.all(
    menuItems.map(async (item) => {
      const { url, resource } = await resolveMenuItemUrlAndResource(
        theme,
        item,
        {
          trailingSlash:
            options?.currentUrl?.endsWith('/') && options.currentUrl !== '/',
        },
      );

      const childItems =
        item.items && (await resolveMenuItems(theme, item.items, options));

      return {
        ...item,
        url,
        resource,
        levels: countChildItemLevels(childItems),
        current: options?.currentUrl === url,
        active: options?.currentUrl?.startsWith(url),
        ...(childItems
          ? {
              items: childItems,
              child_current: isChildItemCurrent(childItems),
              child_active: isChildItemActive(childItems),
            }
          : undefined),
      };
    }),
  );
}

export async function resolveMenuItemUrlAndResource(
  theme: SwellTheme,
  item: SwellMenuItem,
  options?: { trailingSlash?: boolean },
): Promise<{
  url: string;
  resource?: SwellStorefrontRecord | SwellStorefrontCollection;
}> {
  if (!item) return { url: '#invalid-link-item' };

  if (typeof item === 'object' && item !== null) {
    const { url: itemUrl, resource } = await getMenuItemUrlAndResource(
      theme,
      item,
    );

    let url = itemUrl;

    if (url.length > 1) {
      // Add/remove trailing slash
      const endsWithSlash = url.endsWith('/');

      if (options?.trailingSlash) {
        if (!endsWithSlash) {
          url = url + '/';
        }
      } else if (endsWithSlash) {
        url = url.slice(0, -1);
      }
    }

    return { url, resource }; // TODO wrap nuxt-i18n to generate localized path
  } else {
    // Treat item as complete URL
    return { url: item };
  }
}

function countChildItemLevels(items: SwellMenuItem[]): number {
  return (
    items?.reduce(
      (max, item) =>
        Math.max(max, item.items ? 1 + countChildItemLevels(item.items) : 0),
      0,
    ) || 0
  );
}

function isChildItemCurrent(items: SwellMenuItem[]): boolean {
  return items.some(
    (item: SwellMenuItem) =>
      item.current || (item.items && isChildItemActive(item.items)),
  );
}

function isChildItemActive(items: SwellMenuItem[]): boolean {
  return items.some(
    (item: SwellMenuItem) =>
      item.active || (item.items && isChildItemActive(item.items)),
  );
}

export function getMenuItemValueId(value: unknown): string {
  // Get slug from linked object slug or id, fall back to value itself
  const fallback = typeof value === 'string' ? value : '';
  const slug = get(value, 'id', get(value, 'slug', fallback)) || '';

  return slug;
}

export async function getMenuItemUrlAndResource(
  theme: SwellTheme,
  menuItem: SwellMenuItem,
): Promise<{
  url: string;
  resource?: SwellStorefrontRecord | SwellStorefrontCollection;
}> {
  const { type, value, url, model } = menuItem;

  if (typeof type === 'undefined' && url) {
    return { url };
  }

  // Return URL value as-is
  if (type === SwellMenuItemType.Url) {
    return { url: typeof value === 'string' ? value : '' };
  }

  const id = getMenuItemValueId(value);

  // Build path based on content type of item
  switch (type) {
    case SwellMenuItemType.Home:
      return {
        url: getMenuItemStorefrontUrl(theme, 'index'),
      };

    case SwellMenuItemType.Category: {
      if (!id) {
        return {
          url: getMenuItemStorefrontUrl(theme, 'categories/index'),
        };
      }

      return deferMenuItemUrlAndResource(theme, 'categories/category', id);
    }

    case SwellMenuItemType.Product: {
      if (!id) {
        return {
          url: getMenuItemStorefrontUrl(theme, 'products/index'),
        };
      }

      return deferMenuItemUrlAndResource(theme, 'products/product', id);
    }

    case SwellMenuItemType.ProductList:
      return {
        url: getMenuItemStorefrontUrl(theme, 'products/index'),
      };

    case SwellMenuItemType.Page:
      return deferMenuItemUrlAndResource(theme, 'pages/page', id);

    case SwellMenuItemType.Blog:
      return deferMenuItemUrlAndResource(theme, 'blogs/blog', id, (blog) => {
        const blogCategory = new SwellStorefrontRecord(
          theme.swell,
          'content/blog-categories',
          blog.category_id as string,
        );
        return blogCategory.slug as Promise<string>;
      });

    case SwellMenuItemType.BlogCategory:
      return deferMenuItemUrlAndResource(theme, 'blogs/category', id);

    case SwellMenuItemType.ContentList: {
      if (model) {
        const slug = model?.replace('content/', '');

        return {
          url: getMenuItemStorefrontUrl(theme, 'content/index', slug),
          resource: new SwellStorefrontCollection(theme.swell, model),
        };
      }

      break;
    }

    case SwellMenuItemType.Content: {
      if (model) {
        const collectionSlug = model?.replace('content/', '');

        return deferMenuItemUrlAndResource(
          theme,
          'content/content',
          id,
          collectionSlug,
        );
      }

      break;
    }

    case SwellMenuItemType.Search:
      return {
        url: getMenuItemStorefrontUrl(theme, 'search'),
      };

    default:
      break;
  }

  return {
    url: `/${id}`,
  };
}

export function getMenuItemStorefrontUrl(
  theme: SwellTheme,
  pageId: string,
  slug?: string,
  collectionSlug?: string,
): string {
  // TODO: replace substitution logic with pathToRegexp

  const { props } = theme;
  let url = props?.pages?.find((page) => page.id === pageId)?.url;

  if (url?.includes(':collection') && collectionSlug) {
    url = url.replace(':collection', collectionSlug);
  }

  if (url?.includes(':slug')) {
    url = url.replace(':slug', slug || '');
  }

  return url || `/${slug || ''}`;
}

export async function deferMenuItemUrlAndResource(
  theme: SwellTheme,
  pageId: string,
  id: string,
  collectionSlugOrHandler?:
    | string
    | ((resource: SwellStorefrontRecord) => Promise<string>),
): Promise<{ url: string; resource?: SwellStorefrontRecord }> {
  const { props } = theme;

  const collection = props?.pages?.find(
    (page) => page.id === pageId,
  )?.collection;

  const resource = collection
    ? new SwellStorefrontRecord(theme.swell, collection, id)
    : undefined;

  const slug = ((await resource?.slug) as string) || id;

  let collectionSlug: string | undefined =
    typeof collectionSlugOrHandler === 'string'
      ? collectionSlugOrHandler
      : undefined;

  if (resource?.id && typeof collectionSlugOrHandler === 'function') {
    collectionSlug = await collectionSlugOrHandler(resource);
  }

  return {
    url: getMenuItemStorefrontUrl(
      theme,
      pageId,
      slug,
      typeof collectionSlug === 'string' ? collectionSlug : undefined,
    ),
    resource,
  };
}
