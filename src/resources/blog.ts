import { SwellStorefrontRecord } from '@/resources';

import type { Swell } from '@/api';
import type { SwellData } from 'types/swell';
import type {
  SwellBlog as SwellBlogType,
  SwellBlogCategory,
} from './swell_types';

export default class SwellBlog extends SwellStorefrontRecord<SwellBlogType> {
  constructor(
    swell: Swell,
    blogId: string,
    categoryId?: string,
    query?: SwellData,
  ) {
    super(swell, 'content/blogs', blogId, query, async function () {
      this._query = { ...this._query, expand: 'author' };

      // Instead of this._defaultGetter().call(this), directly call the resource
      const resource = this.getResourceObject();
      const blog = await resource.get(this._id, this._query) as SwellBlogType | null;

      if (!blog) {
        return null;
      }

      if (categoryId) {
        blog.category = new SwellStorefrontRecord<SwellBlogCategory>(
          this._swell,
          'content/blog-categories',
          categoryId,
        ) as unknown as SwellBlogCategory;
      }

      return blog;
    });

    return this._getProxy();
  }
}
