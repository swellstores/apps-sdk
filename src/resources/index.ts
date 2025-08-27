import SwellAccount from './account';
import SwellAddresses from './addresses';
import SwellBlogCategory from './blog_category';
import SwellBlog from './blog';
import SwellCart from './cart';
import SwellCategories from './categories';
import SwellCategory from './category';
import SwellOrder from './order';
import SwellOrders from './orders';
import SwellPage from './page';
import SwellPredictiveSearch from './predictive_search';
import SwellProduct from './product';
import SwellProductRecommendations from './product_recommendations';
import SwellSearch from './search';
import SwellSubscription from './subscription';
import SwellSubscriptions from './subscriptions';
import SwellVariant from './variant';

import type { Swell } from '@/api';
import type { SwellData } from 'types/swell';

export {
  SwellAccount,
  SwellAddresses,
  SwellBlogCategory,
  SwellBlog,
  SwellCart,
  SwellCategories,
  SwellCategory,
  SwellOrder,
  SwellOrders,
  SwellPage,
  SwellPredictiveSearch,
  SwellProduct,
  SwellProductRecommendations,
  SwellSearch,
  SwellSubscription,
  SwellSubscriptions,
  SwellVariant,
};

/**
 * Factory function to create resource instances with a uniform interface.
 * This encapsulates the knowledge of different constructor signatures
 * so that consumers (like proxima) don't need to know about them.
 */
export function createSwellResource(
  ResourceClass: any,
  swell: Swell,
  slug?: string,
  query?: SwellData
): any {
  const className = ResourceClass.name;
  
  // Handle different resource types based on their class names
  // This keeps the instantiation logic within apps-sdk
  
  // Singletons (no ID parameter)
  if (className === 'SwellAccount' || className === 'SwellCart') {
    return new ResourceClass(swell);
  }
  
  // Collections (optional query parameter)
  if (className === 'SwellCategories' || 
      className === 'SwellAddresses' || 
      className === 'SwellOrders' || 
      className === 'SwellSubscriptions') {
    return new ResourceClass(swell, query || {});
  }
  
  // Search resources (query string parameter)
  if (className === 'SwellSearch' || className === 'SwellPredictiveSearch') {
    return new ResourceClass(swell, slug || query?.q || '');
  }
  
  // Blog resource with optional category
  if (className === 'SwellBlog' && query?.category_id) {
    return new ResourceClass(swell, slug || '', query.category_id, query);
  }
  
  // Records (ID and optional query) - default case
  return new ResourceClass(swell, slug || '', query || {});
}
