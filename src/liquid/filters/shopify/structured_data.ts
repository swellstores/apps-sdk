import { StorefrontResource } from '@/resources';
import { isLikeShopifyArticle } from '@/compatibility/shopify-objects/article';
import { isLikeShopifyProduct } from '@/compatibility/shopify-objects/product';
import { resolveAllKeys } from '@/liquid/utils';
import { isObject } from '@/utils';

import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '../..';
import type {
  ShopifyArticle,
  ShopifyProduct,
  ShopifyVariant,
} from 'types/shopify';

// {{ product | structured_data }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return async function filterStructuredData(input: unknown): Promise<unknown> {
    let value = input;

    if (value instanceof StorefrontResource) {
      value = await value.resolve();
    }

    await resolveAllKeys(value);

    if (isObject(value)) {
      if (isLikeShopifyProduct(value)) {
        return JSON.stringify(
          value.variants_count > 0
            ? convertToSchemaOrgProductGroup(value)
            : convertToSchemaOrgProduct(
                value as unknown as ShopifyVariant,
                value,
              ),
        );
      }

      if (isLikeShopifyArticle(value)) {
        return JSON.stringify(convertToSchemaOrgArticle(value));
      }
    }

    return value;
  };
}

interface SchemaOrgArticle {
  '@context': 'https://schema.org';
  '@type': 'Article';
  '@id': string;
  url: string;
  name: string;
  author: string;
  image?: string;
  abstract: string;
  keywords: string[];
  articleBody: string;
  dateCreated: string;
  dateModified: string;
  datePublished: string;
}

function convertToSchemaOrgArticle(article: ShopifyArticle): SchemaOrgArticle {
  const schemaOrgArticle: SchemaOrgArticle = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': article.url,
    url: article.url,
    name: article.title,
    author: article.author,
    image: article.image?.src.url || undefined,
    abstract: article.excerpt,
    keywords: article.tags,
    articleBody: article.content,
    dateCreated: article.created_at,
    dateModified: article.updated_at,
    datePublished: article.published_at,
  };

  return schemaOrgArticle;
}

interface SchemaOrgOffer {
  '@type': 'Offer';
  availability: string;
  price: number;
  priceCurrency: string;
}

interface SchemaOrgProduct {
  '@context': 'https://schema.org';
  '@type': 'Product';
  '@id': string;
  url: string;
  sku: string;
  name: string;
  image?: string;
  keywords: string[];
  description: string;
  offers: SchemaOrgOffer;
}

function convertToSchemaOrgProduct(
  variant: ShopifyVariant,
  product: ShopifyProduct,
): SchemaOrgProduct {
  const schemaOrgProduct: SchemaOrgProduct = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': variant.url,
    url: variant.url,
    sku: variant.sku,
    name: variant.title,
    image: variant.featured_image?.src.url || undefined,
    keywords: product.tags,
    description: product.description,
    offers: {
      '@type': 'Offer',
      availability: variant.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      price: variant.price,
      priceCurrency: 'USD',
    },
  };

  return schemaOrgProduct;
}

interface SchemaOrgProductGroup {
  '@context': 'https://schema.org';
  '@type': 'ProductGroup';
  productGroupID: string;
  url: string;
  name: string;
  description: string;
  variesBy: string[];
  hasVariant: SchemaOrgProduct[];
}

function convertToSchemaOrgProductGroup(
  product: ShopifyProduct,
): SchemaOrgProductGroup {
  const schemaOrgProductGroup: SchemaOrgProductGroup = {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    productGroupID: String(product.id),
    url: product.url,
    name: product.title,
    description: product.description,
    variesBy: product.options,
    hasVariant: product.variants.map((variant) =>
      convertToSchemaOrgProduct(variant, product),
    ),
  };

  return schemaOrgProductGroup;
}
