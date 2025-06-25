import { StorefrontResource, cloneStorefrontResource } from '@/resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyImage from './image';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';
import type { ShopifyArticle } from 'types/shopify';

export default function ShopifyArticle(
  instance: ShopifyCompatibility,
  blog: StorefrontResource | SwellRecord,
  blogCategory?: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyArticle> {
  if (blog instanceof ShopifyResource) {
    return blog.clone() as ShopifyResource<ShopifyArticle>;
  }

  if (blog instanceof StorefrontResource) {
    blog = cloneStorefrontResource(blog);
  }

  if (blogCategory) {
    if (blogCategory instanceof StorefrontResource) {
      blogCategory = cloneStorefrontResource(blogCategory);
    }

    blog.category = blogCategory;
  }

  return new ShopifyResource<ShopifyArticle>({
    author: deferWith(blog, (blog) => blog.author?.name || blog.author?.email),
    content: defer(() => blog.content),
    created_at: defer(() => blog.date_created),
    excerpt: defer(() => blog.summary),
    excerpt_or_content: deferWith(blog, (blog) => blog.summary || blog.content),
    handle: defer(() => blog.slug),
    id: defer(() => blog.id),
    image: deferWith(blog, (blog) =>
      blog.image ? ShopifyImage(instance, blog.image) : undefined,
    ),
    metafields: {},
    published_at: deferWith(
      blog,
      (blog) => blog.date_published || blog.date_created,
    ),
    tags: defer(() => blog.tags),
    template_suffix: defer(() => blog.theme_template),
    title: defer(() => blog.title),
    updated_at: deferWith(
      blog,
      (blog) => blog.date_updated || blog.date_created,
    ),
    url: deferWith([blog, blog.category], (blog, blogCategory) =>
      blogCategory ? `/blogs/${blogCategory?.slug}/${blog.slug}` : '',
    ),
    user: defer(() => blog.author),

    // Comments not supported
    comment_post_url: '',
    comments: [],
    comments_count: 0,
    'comments_enabled?': false,
    'moderated?': false,
  });
}

export function isLikeShopifyArticle(value: unknown): value is ShopifyArticle {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, 'title') &&
    Object.hasOwn(value, 'content') &&
    Object.hasOwn(value, 'comments') &&
    Object.hasOwn(value, 'moderated?') &&
    Object.hasOwn(value, 'published_at') &&
    Object.hasOwn(value, 'excerpt_or_content')
  );
}
