# Swell Apps SDK

The Swell Apps SDK is a TypeScript library for building server-side Swell apps. It
provides access to the Backend and Storefront APIs, along with helpers for app
configuration, customer sessions and staff identity.

Use it in Swell-hosted apps, Cloudflare Workers or Node.js servers. For browser
applications, use [`swell-js`](https://github.com/swellstores/swell-js).

## Installation

```sh
npm install @swell/apps-sdk@next swell-js@^5.9.0
```

Supports Node.js 22.22.2+ and Cloudflare Workers, with no Node compatibility flags
needed in Workers. Includes ES modules, CommonJS and TypeScript declarations.

Version 2 replaces the 1.x theme API. Existing theme applications should remain on
1.x until migrated to `@swell/themes-sdk`.

## Getting started

### Headers and app proxying

When your app runs on Swell, the platform supplies request headers with API
credentials, store configuration and storefront context. Pass the request's headers
to the SDK to work with the current store. Create clients for each incoming request.

Only use these headers when they come through Swell's trusted proxy. On other servers,
use explicit credentials as shown below.

### Backend API calls

```ts
import { SwellBackendAPI } from '@swell/apps-sdk';

// Use the credentials supplied to your Swell-hosted app.
const backend = new SwellBackendAPI({ headers: request.headers });

// Fetch products from the Backend API.
const products = await backend.get('/products', { limit: 10 });
```

For an external server, read credentials from your server configuration:

```ts
const backend = new SwellBackendAPI({ storeId, secretKey, apiHost });
```

### Storefront API calls

Use the Storefront API for customer-facing data and cart or account operations.
In this example, `cookies` is your framework's cookie jar. Its reads must include
pending writes and deletions.

```ts
import { getStorefrontConfig } from '@swell/apps-sdk';
import { createStorefrontClient } from '@swell/apps-sdk/storefront';

// Build the storefront config from the platform headers.
const config = getStorefrontConfig(request.headers);
const storefront = createStorefrontClient(config, {
  cookies: {
    get: name => cookies.get(name)?.value,
    set: (name, value, options) => { cookies.set(name, value, options); },
  },
});

// Use the same methods available in swell-js.
const products = await storefront.products.list({ limit: 10 });
```

External servers can supply `storeId`, `publicKey` and `swell-js` options such as
`url`, `locale` or `currency` directly as the config. Only the `/storefront` entry
loads the `swell-js` runtime.

### Browser configuration

Send the public config from `getStorefrontConfig` to your browser app through a
loader or endpoint with `Cache-Control: private, no-store`. Then initialize swell-js:

```ts
import swell from 'swell-js';

swell.init(config.storeId, config.publicKey, config);
```

This config excludes backend credentials. For server-side metadata, use
`parseSwellHeaders(headers)`. It reads headers without verifying their signature;
keep its result on the server because it includes the backend token.

### Staff identity

Use `requireStaff` to check that a request belongs to a staff member of the current
store before applying your application's permission checks:

```ts
import { requireStaff } from '@swell/apps-sdk';

const staff = await requireStaff({
  headers: request.headers,
  method: request.method,
  origin: appOrigin, // Your configured app origin.
  cookies: { get: name => cookies.get(name)?.value },
});
```

## API reference

### Backend client

`apiHost` is a required absolute HTTP(S) URL. Use either `secretKey` or `accessToken`;
do not mix explicit credentials with `headers`. Invalid constructor options throw
immediately. All backend methods return promises and reject on failure.

| Method | Result |
| --- | --- |
| `get(path, query?)` | Response data |
| `post(path, data?)`, `put(path, data?)`, `delete(path, data?)` | Response data |
| `settings(appId?)` | Installed-app settings; defaults to the configured app ID |
| `workflows.create(name, params?)` | Created workflow instance |
| `transaction(ops, options?)` | Operation results in input order |
| `functions.call(appId, name, data?, options?)` | Function response payload |

Response generics describe expected data without validating it. `SwellCollection<T>`
is for ordinary paginated lists; aggregations and `page: false` return other shapes.

Requests stay on the configured host; redirects are refused. Use endpoint paths,
not absolute URLs. Request IDs are forwarded when supplied. GET queries use bracket
notation, omit undefined values, encode Dates as ISO strings, and preserve native
null separately from the string `'null'`. Other methods send JSON.

**Workflows:** supplied parameters must be JSON-safe and at most 128 KiB of serialized
UTF-8 JSON. Omitted parameters are not sent. Invalid or oversized parameters reject
with `workflow_params_unserializable` or `workflow_params_too_large`.

**Transactions:** each operation contains `method`, `url` and optional `data`.
Retries are off by default. Set `retry: true` or
`retry: { limit: 3, base: 100, max: 5000, jitter: true }` to enable them. These are the
defaults: `limit` counts additional attempts, and delays are in milliseconds. Only
`transaction_conflict` and `transaction_throttled` retry. Ordinary requests and network
failures are not retried.

**Private functions:** use the app slug from `Swell-App-Id` and authorize the caller
first. `options.method` defaults to `post`; `get`, `put` and `delete` are also supported.
GET data must contain only flat string, number or boolean values. Caller headers are
not forwarded; response status and headers are not returned. Function errors and
non-2xx statuses reject with `SwellError`.

Private-app calls require platform support for app-slug lookup and fail on deployments
without it. Function execution and `req.swell` remain managed by the CLI and platform.

### Cookies and caching

Cookie adapters exchange decoded values and own the current state. If your framework
reads only incoming cookies, track pending writes and deletions in request-local state.
The SDK keeps no cookie cache.

Native cookie names and defaults apply: path `/`, one week, `sameSite: 'lax'`.
`cookieOptions` replaces these defaults; `{}` delegates attributes to the adapter.
Per-write attributes take precedence.

Omit `cookies.set` for read-only access. Attempted writes then throw, including session
rotation during GET requests. A supplied writer may throw or skip a write; after a skip,
its reader must still report the actual state. Writer return values are ignored.
Persist cookies in writable route handlers or actions.

For caching, replace `storefront.request` before first use. The SDK has no built-in cache.

### Staff verification

`requireStaff` verifies `_swell_admin_session` against the current store and returns
`{ userId, storeId }`. Use a trusted `appOrigin`: every non-GET request requires a
matching `Origin` and, when present, `Sec-Fetch-Site: same-origin`. Failures reject.
The helper checks identity and request origin; your application enforces permissions.

### Errors

Import `SwellError` from the root package. Use `status` and optional `code`/`body` for
error handling; `message` is for people and may change.

- Structured backend errors retain their body; string errors have no body.
- HTTP-200 non-GET validation failures use status 400 and the `errors` field map as
  `body`. Successful GET responses containing `errors` are returned as data.
- Function invocation failures retain the response payload, or the invocation envelope
  when the payload is null or absent, in `body`.
- Network errors remain native. Local configuration errors may be ordinary `Error`
  instances; not every failure is a `SwellError`.

## Development

```sh
npm ci
npm run verify
```

`verify` builds the SDK, runs unit tests and typechecks, then checks the packed package,
browser/Worker boundaries and workerd execution.

## License

[MIT](LICENSE)
