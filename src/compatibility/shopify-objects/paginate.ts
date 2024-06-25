import { ShopifyCompatibility } from '../shopify';
import { SwellStorefrontPagination } from '../../resources';
import { ShopifyResource } from './resource';
import { stringifyQueryParams } from '@/utils';

export default function ShopifyPaginate(
  instance: ShopifyCompatibility,
  pagination: SwellStorefrontPagination,
) {
  const { page, count, pages, page_count, page_limit, next, previous } =
    pagination;
  const currentPage = pages[page] || {};

  return new ShopifyResource({
    current_offset: currentPage.start || 0,
    current_page: page,
    items: count || 0,
    next: next ? getPartObject(page + 1, next?.url) : null,
    page_param: 'page',
    page_size: page_limit,
    pages: page_count,
    parts: Object.keys(pages).map(([page]: any) =>
      getPartObject(
        page,
        page != pagination.page
          ? `${instance.swell.url.pathname}?${stringifyQueryParams({
              ...instance.swell.queryParams,
              page,
            })}`
          : undefined,
      ),
    ),
    previous: previous ? getPartObject(page - 1, previous?.url) : null,
  });
}

function getPartObject(num: string | number, url?: string) {
  return {
    is_link: url ? true : false,
    title: String(num),
    url: url || null,
  };
}
