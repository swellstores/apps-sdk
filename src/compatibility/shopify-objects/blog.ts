import { StorefrontResource, cloneStorefrontResource } from '@/resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyArticle from './article';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellData, SwellRecord } from 'types/swell';
import type { ShopifyBlog } from 'types/shopify';

export default function ShopifyBlog(
  instance: ShopifyCompatibility,
  blogCategory: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyBlog> {
  if (blogCategory instanceof ShopifyResource) {
    return blogCategory.clone() as ShopifyResource<ShopifyBlog>;
  }

  if (blogCategory instanceof StorefrontResource) {
    blogCategory = cloneStorefrontResource(blogCategory);
  }

  const allTags = deferWith(blogCategory.blogs, (blogs) => {
    const set: Set<string> = blogs?.results?.reduce(
      (set: Set<string>, blog: SwellData) => {
        for (const tag of blog.tags || []) {
          set.add(tag);
        }

        return set;
      },
      new Set(),
    );

    return Array.from(set.values());
  });

  return new ShopifyResource<ShopifyBlog>({
    all_tags: allTags,
    articles: deferWith(blogCategory, (blogCategory: SwellRecord) => {
      return (
        blogCategory.blogs?._cloneWithCompatibilityResult(
          (blogs: SwellData) => {
            return {
              results: blogs?.results?.map((blog: SwellRecord) =>
                ShopifyArticle(instance, blog, blogCategory),
              ),
            };
          },
        ) || []
      );
    }),
    articles_count: deferWith(blogCategory.blogs, (blogs) => blogs?.count || 0),
    handle: defer(() => blogCategory.slug),
    id: defer(() => blogCategory.id),
    metafields: {},
    next_article: undefined, // TODO
    previous_article: undefined, // TODO
    tags: allTags, // TODO: this should only apply to articles in the current view
    template_suffix: undefined, // TODO
    title: defer(() => blogCategory.title),
    url: deferWith(
      blogCategory,
      (blogCategory) => `/blogs/${blogCategory.slug}`,
    ),

    // Not supported
    'comments_enabled?': false,
    'moderated?': false,
  });
}
