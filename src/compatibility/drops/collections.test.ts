import { describeFilter } from '../../liquid/test-helpers';

import { ShopifyCompatibility } from '../shopify';

import CollectionsDrop from './collections';

import type { SwellClient } from 'swell-js';
import type { SwellData } from 'types/swell';

describeFilter('compatibility/drops/collections', (render, liquid) => {
  beforeEach(() => {
    jest.replaceProperty(liquid.theme.swell, 'storefront', {
      categories: {
        // eslint-disable-next-line @typescript-eslint/require-await
        async list(query?: SwellData) {
          const limit = Number(query?.limit ?? 15);

          const pages = [
            { id: '1', slug: 'category-1', name: 'Category 1' },
            { id: '2', slug: 'category-2', name: 'Category 2' },
            { id: '3', slug: 'category-3', name: 'Category 3' },
          ];

          const results = pages.slice(0, limit);

          return {
            count: results.length,
            results,
          };
        },
        // eslint-disable-next-line @typescript-eslint/require-await
        async get(id: string, _query: unknown) {
          switch (id) {
            case 'category-2':
              return { id: '2', slug: 'category-2', name: 'Category 2' };

            default:
              return null;
          }
        },
      } as unknown,
    } as SwellClient);
  });

  it('should render collections drop', async () => {
    const compatibility = new ShopifyCompatibility(liquid.theme);

    const data = {
      collections: new CollectionsDrop(compatibility),
    };

    const result = await render("{{ collections['category-2'].title }}", data);

    expect(result).toStrictEqual('Category 2');
  });

  it('should render collections drop with pagination', async () => {
    const compatibility = new ShopifyCompatibility(liquid.theme);

    const data = {
      collections: new CollectionsDrop(compatibility),
    };

    const result = await render(
      `{%- paginate collections by 2 -%}
  {%- for category in collections -%}
{{ category.title }}
{% endfor -%}
{%- endpaginate %}`,
      data,
    );

    expect(result).toStrictEqual('Category 1\nCategory 2\n');
  });
});
