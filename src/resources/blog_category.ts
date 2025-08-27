import { SwellStorefrontCollection, SwellStorefrontRecord } from '@/resources';

import type { Swell } from '@/api';
import type { SwellCollection, SwellData } from 'types/swell';
import type {
  SwellBlog,
  SwellBlogCategory as SwellBlogCategoryType,
} from './swell_types';

export default class SwellBlogCategory extends SwellStorefrontRecord<SwellBlogCategoryType> {
  constructor(swell: Swell, id: string, query?: SwellData) {
    super(swell, 'content/blog-categories', id, query, async function () {
      const category = await this._defaultGetter();

      if (!category) {
        return null;
      }

      category.blogs = new SwellStorefrontCollection<SwellBlog>(
        this._swell,
        'content/blogs',
        {
          category_id: category.id,
          expand: 'author',
        },
      ) as SwellCollection<SwellBlog>;

      return category;
    });

    return this._getProxy();
  }
}
