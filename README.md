# Swell Apps SDK

The Swell Apps SDK is a TypeScript-based library designed to simplify the development of isomorphic Swell apps by providing streamlined API access, theme rendering capabilities, and comprehensive caching solutions.

## Features

### Core functionality
- **Unified API access** - Seamless integration with both Swell Backend API and Storefront API
- **Authentication handling** - Automatic scoped access token management based on app permissions
- **Theme rendering** - Complete Shopify-compatible theme system with Liquid templating
- **Resource management** - Deferred loading of storefront resources (products, categories, etc.)
- **Caching system** - Multi-tier caching with Cloudflare KV integration
- **Shopify compatibility** - Full compatibility layer for migrating Shopify themes and apps

### Theme capabilities
- **Liquid templating** - Enhanced Liquid engine with Swell-specific objects and filters
- **Section rendering** - Dynamic section management with schema support
- **Settings resolution** - Automatic theme and section settings processing
- **Layout system** - Flexible layout rendering with section groups
- **Asset management** - Optimized asset loading and URL generation
- **Localization** - Multi-language support with translation rendering

### Developer experience
- **TypeScript support** - Full type safety with comprehensive type definitions
- **Isomorphic design** - Works seamlessly in both browser and server environments
- **Error handling** - Robust error management with detailed debugging information
- **Performance optimized** - Built-in caching and resource optimization
- **Extensible architecture** - Plugin system for custom resource types

## Installation

```bash
npm install @swell/apps-sdk
```

## Getting started

### Basic setup

```typescript
import { Swell } from '@swell/apps-sdk';

// Initialize Swell instance in your app frontend
const swell = new Swell({
  serverHeaders: context.request.headers, // Headers from worker environment
});

// Make backend API calls
const products = await swell.backend.get('/products');

// Make storefront API calls
const cart = await swell.storefront.get('/cart');
```

### Headers and app proxying

When your Swell app is deployed, it runs behind Swell's proxy infrastructure. The proxy automatically injects essential headers that contain authentication tokens, store configuration, and storefront context. These headers are critical for the SDK to function properly:

```typescript
// Headers passed from Swell's proxy contain:
// - swell-store-id: The store identifier
// - swell-public-key: Frontend API access key
// - swell-access-token: Backend API access token (scoped to app permissions)
// - swell-storefront-id: Current storefront instance
// - swell-environment-id: Environment (development, staging, production)
// - swell-theme-id: Active theme identifier
// - swell-storefront-context: Preloaded cart/account data

const swell = new Swell({
  serverHeaders: context.request.headers, // Contains all proxy-injected headers
  getCookie: (name) => getCookieValue(name),
  setCookie: (name, value, options) => setCookieValue(name, value, options),
});
```

Without these headers, the SDK cannot:
- Authenticate with Swell APIs
- Determine which store and storefront to operate on
- Access cached resources or maintain session state
- Render themes with proper configuration

The `serverHeaders` parameter should always be passed the complete headers object from your app's request context to ensure full functionality.

### Theme rendering

```typescript
import { Swell, SwellTheme, SwellProduct } from '@swell/apps-sdk';

const swell = new Swell({
  serverHeaders: context.request.headers,
  ...options,
});

// Initialize theme with optional configuration
const theme = new SwellTheme(swell, {
  forms: formConfigs,
  resources: customResources,
  globals: additionalGlobals,
});

// Fetch settings and set global context
await theme.initGlobals('product'); // page ID

// Create page data with deferred resource loading
const data = {
  product: new SwellProduct(swell, context.params.id),
};

// Render theme page
const renderedPage = await theme.renderPage(data);
```

## API reference

### Swell class

The main entry point for SDK functionality:

```typescript
class Swell {
  // API access
  backend: SwellBackendAPI;
  storefront: typeof SwellJS;
  
  // Configuration
  config: SwellAppConfig;
  url: URL;
  headers: Record<string, string>;
  queryParams: ParsedQs;
  
  // State
  isEditor: boolean;
  isPreview: boolean;
  storefrontContext: SwellData;
  
  // Methods
  get<T>(url: string, query?: SwellData): Promise<T>;
  post<T>(url: string, data: SwellData): Promise<T>;
  put<T>(url: string, data: SwellData): Promise<T>;
  delete<T>(url: string, data?: SwellData): Promise<T>;
  getCachedResource<T>(key: string, args: unknown[], handler: () => T): Promise<T>;
}
```

### SwellTheme class

Handles theme rendering and management:

```typescript
class SwellTheme {
  // Core properties
  swell: Swell;
  globals: ThemeGlobals;
  liquidSwell: LiquidSwell;
  
  // Methods
  initGlobals(pageId: string, altTemplate?: string): Promise<void>;
  renderPage(pageData?: SwellData, altTemplate?: string): Promise<string>;
  renderSection(sectionId: string, pageData?: SwellData): Promise<string>;
  renderLayout(layoutName?: string, data?: SwellData): Promise<string>;
  getSectionSchema(sectionName: string): Promise<ThemeSectionSchema>;
  setGlobals(globals: Partial<ThemeGlobals>): void;
}
```

### Resource classes

Built-in storefront resource classes for deferred loading:

#### Standard resources
- `SwellAccount` - Customer account management
- `SwellBlog` - Blog post content
- `SwellBlogCategory` - Blog categorization
- `SwellCart` - Shopping cart state
- `SwellCategory` - Product categories
- `SwellOrder` - Order information
- `SwellPage` - Static pages
- `SwellProduct` - Product details
- `SwellVariant` - Product variants

#### Primitive resources
- `SwellStorefrontCollection` - Collection results with pagination
- `SwellStorefrontRecord` - Individual records
- `SwellStorefrontSingleton` - Unique resources (cart, account)

```typescript
// Create custom resource class
class MyAppCollection extends SwellStorefrontCollection {
  constructor(swell: Swell, query: SwellData = {}) {
    super(swell, 'my-app-collection', query);
    return this._getProxy();
  }
}

// Usage in theme data
const data = {
  myCollection: new MyAppCollection(swell, { limit: 20 }),
};
```

## Caching

### Memory caching
Resources are automatically cached in memory per worker instance:

```typescript
// Cached resource with custom handler
const cachedData = await swell.getCachedResource(
  'expensive-operation',
  [param1, param2],
  async () => {
    return await performExpensiveOperation(param1, param2);
  }
);
```

### Cloudflare KV caching
For production scalability, enable KV caching:

```typescript
const swell = new Swell({
  serverHeaders: context.request.headers,
  workerEnv: context.locals.runtime.env, // Contains THEME KV binding
  workerCtx: context.locals.runtime.ctx,  // Worker context
});
```

### Cache invalidation
Caches are automatically invalidated based on:
- Session cookies (for cart/account data)
- Theme configuration versions
- Storefront environment changes

## Shopify compatibility

The SDK includes comprehensive Shopify compatibility for theme migration.

### Supported Shopify features
- **Template mapping** - Direct file path compatibility
- **Liquid objects** - Full object structure compatibility
- **Form handling** - Compatible form endpoints and validation
- **Section schemas** - Shopify section configuration format
- **Settings data** - `settings_data.json` and `settings_schema.json`

## Liquid templating

Enhanced Liquid templating with Swell-specific features. See [Swell Liquid documentation](https://developers.swell.is/storefronts/swell-liquid-reference) for details.

## Performance optimization

### Lazy loading
Resources are loaded only when accessed in templates:

```liquid
<!-- Product data is fetched only when this line executes -->
{{ product.name }}

<!-- Collection is fetched only when iteration begins -->
{% for item in collection.products %}
  {{ item.name }}
{% endfor %}
```

## Development

### Building the SDK
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch for changes
npm run watch

# Run tests
npm test
```

### Project structure
```
src/
├── api.ts              # Core Swell class and API handling
├── theme.ts            # SwellTheme class and rendering
├── resources.ts        # Storefront resource classes
├── liquid/             # Liquid templating engine
├── compatibility/      # Shopify compatibility layer
├── cache/              # Caching implementations
├── utils/              # Utility functions
└── index.ts            # Main exports
```

## Resources

- [Swell Documentation](https://developers.swell.is/)
- [Apps Development Guide](https://developers.swell.is/apps/overview)
- [Proxima Example App](https://developers.swell.is/storefronts/proxima)
- [Swell Liquid Reference](https://developers.swell.is/storefronts/swell-liquid-reference)
- [GitHub Repository](https://github.com/swellstores/swell-apps-sdk)

## 📄 License

See the [LICENSE](LICENSE) file for details.