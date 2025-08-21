import SwellJS from 'swell-js';

import { describeFilter } from '../../liquid/test-helpers';

import { ShopifyCompatibility } from '../shopify';

import PagesDrop from './pages';

import type { SwellData } from 'types/swell';

describeFilter('compatibility/drops/pages', (render, liquid) => {
  beforeEach(() => {
    jest.replaceProperty(liquid.theme.swell, 'storefront', {
      content: {
        // eslint-disable-next-line @typescript-eslint/require-await
        async list(type: string, query?: SwellData) {
          switch (type) {
            case 'pages': {
              const limit = Number(query?.limit ?? 15);

              const pages = [
                { id: '1', slug: 'page-1', title: 'Page 1' },
                { id: '2', slug: 'page-2', title: 'Page 2' },
                { id: '3', slug: 'page-3', title: 'Page 3' },
              ];

              const results = pages.slice(0, limit);

              return {
                count: results.length,
                results,
              };
            }

            default:
              return { count: 0, results: [] };
          }
        },
        // eslint-disable-next-line @typescript-eslint/require-await
        async get(type: string, id: string, _query: unknown) {
          switch (type) {
            case 'pages': {
              switch (id) {
                case 'page-2':
                  return { id: '2', slug: 'page-2', title: 'Page 2' };

                default:
                  return null;
              }
            }

            default:
              return null;
          }
        },
      } as unknown,
    } as typeof SwellJS);
  });

  it('should render pages drop', async () => {
    const compatibility = new ShopifyCompatibility(liquid.theme);

    const data = {
      pages: new PagesDrop(compatibility),
    };

    const result = await render("{{ pages['page-2'].title }}", data);

    expect(result).toStrictEqual('Page 2');
  });

  it('should render pages drop with pagination', async () => {
    const compatibility = new ShopifyCompatibility(liquid.theme);

    const data = {
      pages: new PagesDrop(compatibility),
    };

    const result = await render(
      `{%- paginate pages by 2 -%}
  {%- for page in pages -%}
{{ page.title }}
{% endfor -%}
{%- endpaginate %}`,
      data,
    );

    expect(result).toStrictEqual('Page 1\nPage 2\n');
  });
});
