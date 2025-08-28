import SwellAccount from './account';
import SwellAddresses from './addresses';
import SwellBlog from './blog';
import SwellBlogCategory from './blog_category';
import SwellCart from './cart';
import SwellCategory from './category';
import SwellCategories from './categories';
import SwellOrder from './order';
import SwellOrders from './orders';
import SwellPage from './page';
import SwellPredictiveSearch from './predictive_search';
import SwellProduct from './product';
import SwellSearch from './search';
import SwellSubscription from './subscription';
import SwellSubscriptions from './subscriptions';
import SwellVariant from './variant';

export class AccountResource extends SwellAccount {}
export class AccountAddressesResource extends SwellAddresses {}
export class BlogResource extends SwellBlog {}
export class BlogCategoryResource extends SwellBlogCategory {}
export class CartResource extends SwellCart {}
export class CategoryResource extends SwellCategory {}
export class CategoriesResource extends SwellCategories {}
export class AccountOrderResource extends SwellOrder {}
export class AccountOrdersResource extends SwellOrders {}
export class PageResource extends SwellPage {}
export class PredictiveSearchResource extends SwellPredictiveSearch {}
export class ProductResource extends SwellProduct {}
export class SearchResource extends SwellSearch {}
export class AccountSubscriptionResource extends SwellSubscription {}
export class AccountSubscriptionsResource extends SwellSubscriptions {}
export class VariantResource extends SwellVariant {}
