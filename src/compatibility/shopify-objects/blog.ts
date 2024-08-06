import { StorefrontResource } from '../../resources';

import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyArticle from './article';

import type { SwellRecord } from 'types/swell';

export default function ShopifyBlog(
  instance: ShopifyCompatibility,
  blogCategory: StorefrontResource | SwellRecord,
) {
  if (blogCategory instanceof ShopifyResource) {
    return blogCategory.clone();
  }

  const allTags = deferWith(blogCategory.blogs, (blogs: any) =>
    blogs?.results?.reduce((acc: string[], blog: any) => {
      for (const tag of blog.tags || []) {
        if (!acc.includes(tag)) {
          acc.push(tag);
        }
      }
      return acc;
    }, []),
  );

  return new ShopifyResource({
    all_tags: allTags,
    articles: deferWith(blogCategory, (blogCategory: any) => {
      return (
        blogCategory.blogs?._cloneWithCompatibilityResult((blogs: any) => {
          return {
            results: blogs?.results?.map((blog: any) =>
              ShopifyArticle(instance, blog, blogCategory),
            ),
          };
        }) || []
      );
    }),
    articles_count: deferWith(
      blogCategory.blogs,
      (blogs: any) => blogs?.count || 0,
    ),
    handle: defer(() => blogCategory.slug),
    id: deferWith(blogCategory, (blogCategory: any) => blogCategory.id),
    metafields: null,
    next_article: null, // TODO
    previous_article: null, // TODO
    tags: allTags, // TODO: this should only apply to articles in the current view
    template_suffix: null, // TODO
    title: deferWith(blogCategory, (blogCategory: any) => blogCategory.title),
    url: deferWith(
      blogCategory,
      (blogCategory: any) => `/blogs/${blogCategory.slug}`,
    ),

    // Not supported
    'comments_enabled?': false,
    moderated: false,
  });
}
