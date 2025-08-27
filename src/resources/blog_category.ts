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
      // Instead of this._defaultGetter().call(this), directly call the resource
      const resource = this.getResourceObject();
      const category = await resource.get(this._id, this._query) as SwellBlogCategoryType | null;

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
