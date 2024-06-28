import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyImage from './image';

export default function ShopifyArticle(
  instance: ShopifyCompatibility,
  blog: StorefrontResource | SwellRecord,
  blogCategory?: StorefrontResource | SwellRecord,
) {
  if (blog instanceof ShopifyResource) {
    return blog.clone();
  }

  if (blogCategory) {
    blog.category = blogCategory;
  }

  return new ShopifyResource({
    author: deferWith(
      blog,
      (blog: any) => blog.author?.name || blog.author?.email,
    ),
    content: deferWith(blog, (blog: any) => blog.content),
    created_at: defer(() => blog.date_created),
    excerpt: defer(() => blog.summary),
    excerpt_or_content: defer(() => blog.summary || blog.content),
    handle: defer(() => blog.slug),
    id: deferWith(blog, (blog: any) => blog.id),
    image: deferWith(
      blog,
      (blog: any) => blog.image && ShopifyImage(instance, blog.image),
    ),
    metafields: null,
    published_at: deferWith(
      blog,
      (blog: any) => blog.date_published || blog.date_created,
    ),
    tags: deferWith(blog, (blog: any) => blog.tags),
    template_suffix: null, // TODO
    title: deferWith(blog, (blog: any) => blog.title),
    updated_at: deferWith(
      blog,
      (blog: any) => blog.date_updated || blog.date_created,
    ),
    url: deferWith(
      [blog, blog.category],
      (blog: any, blogCategory: any) =>
        blogCategory && `/blogs/${blogCategory?.slug}/${blog.slug}`,
    ),
    user: defer(() => blog.author),

    // Comments not supported
    comment_post_url: null,
    comments: null,
    comments_count: null,
    comments_enabled: false,
    moderated: false,
  });
}
