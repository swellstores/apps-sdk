import { LiquidSwell } from '../..';
import { SwellStorefrontPagination } from '../../../resources';
import ShopifyPaginate from '@/compatibility/shopify-objects/paginate';

// {{ paginate | default_pagination }}

type ShopifyPaginate = {
  current_offset: number;
  current_page: number;
  items: number;
  next: ShopifyPaginatePart;
  page_param: string;
  page_size: number;
  pages: number;
  parts: ShopifyPaginatePart[];
  previous: ShopifyPaginatePart;
};

type ShopifyPaginatePart = {
  is_link: boolean;
  title: string;
  url: string;
};

export default function bind(liquidSwell: LiquidSwell) {
  return (paginate: SwellStorefrontPagination): string => {
    if (!(paginate instanceof SwellStorefrontPagination)) {
      return '';
    }

    if (liquidSwell.theme.shopifyCompatibility) {
      paginate.setCompatibilityProps(
        ShopifyPaginate(liquidSwell.theme.shopifyCompatibility, paginate),
      );
    }

    return `
      ${
        paginate.previous &&
        `<span class="next">
          <a href="${paginate.previous.url}" title="">&raquo; Previous</a>
        </span>`
      }
      ${Object.entries(paginate.pages).map(
        ([page, props]) =>
          `<span class="page ${
            Number(page) === paginate.page ? 'current' : ''
          }">
            <a href="${props.url}" title="">${page}</a>
          </span>`,
      )}
      ${
        paginate.next &&
        `<span class="next">
          <a href="${paginate.next.url}" title="">Next &raquo;</a>
        </span>`
      }
    `;
  };
}
