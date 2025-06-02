import { stringifyQueryParams } from '@/utils';
import { ShopifyResource } from './resource';

import type { SwellStorefrontPagination } from '@/resources';
import type { ShopifyCompatibility } from '../shopify';
import type { ShopifyPaginate, ShopifyPart } from 'types/shopify';

export default function ShopifyPaginate(
  instance: ShopifyCompatibility,
  pagination: SwellStorefrontPagination,
): ShopifyResource<ShopifyPaginate> {
  const { page, count, pages, page_count, limit, next, previous } = pagination;
  const currentPage = pages[page] || {};

  return new ShopifyResource<ShopifyPaginate>({
    current_offset: currentPage.start || 0,
    current_page: page,
    items: count || 0,
    next: next ? getPartObject(String(page + 1), next?.url) : undefined,
    page_param: 'page',
    page_size: limit,
    pages: page_count,
    parts: Object.keys(pages).map((page) =>
      getPartObject(
        page,
        Number(page) !== Number(pagination.page)
          ? `${instance.swell.url.pathname}?${stringifyQueryParams({
              ...instance.swell.queryParams,
              page,
            })}`
          : undefined,
      ),
    ),
    previous: previous
      ? getPartObject(String(page - 1), previous?.url)
      : undefined,
  });
}

function getPartObject(page: string, url?: string): ShopifyPart {
  return {
    is_link: url ? true : false,
    title: page,
    url: url || undefined,
  };
}
