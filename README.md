# Swell Apps SDK

The Swell Apps SDK is a TypeScript library for building server-side Swell apps. It
provides access to the Backend and Storefront APIs, along with helpers for app
configuration, customer sessions and store user identity.

Use it in Swell-hosted apps, Cloudflare Workers or Node.js servers. For browser
applications, use [`swell-js`](https://github.com/swellstores/swell-js).

## Installation

```sh
npm install @swell/apps-sdk@next swell-js@^5.9.1
```

Supports Node.js 22.22.2+ and Cloudflare Workers, with no Node compatibility flags
needed in Workers. Includes ES modules, CommonJS and TypeScript declarations.

Version 2 replaces the 1.x theme API. Existing theme applications should remain on
1.x until migrated to `@swell/themes-sdk`.

## Getting started

### Request context

Swell supplies the current store's configuration, credentials and store user identity
with each request. Verify this context once, then reuse it to create clients and check
store user access. Use the same pattern for Swell-hosted and self-hosted frontends.

```ts
import { verifySwellContext } from '@swell/apps-sdk';

const context = await verifySwellContext(request.headers, {
  appId: 'my-app', // Your app's configured slug.
});
```

When an app component makes the request, `context.surface` says where it runs: `'admin'`, `'checkout'` or `'storefront'`. Treat `'storefront'` and `'checkout'` calls like public routes; check `context.surface === 'admin'` before doing anything that only a merchant may do.

In a server component, pass `await headers()`. Keep the context and clients on the
server, scoped to the incoming request.

### Backend API calls

```ts
import { SwellBackendAPI } from '@swell/apps-sdk';

// Reuse the context resolved for this request.
const backend = new SwellBackendAPI({ context });

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

// Build public storefront configuration from the request context.
const config = getStorefrontConfig(context);
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

Send only this public config to the browser; the request context contains server credentials.

### Store users

A store user is someone signed in to the store's Swell dashboard. Use
`requireStoreUser` to check that a request belongs to one before applying your
application's permission checks:

```ts
import { requireStoreUser } from '@swell/apps-sdk';

const storeUser = requireStoreUser(context); // { userId, storeId }, or a 401 SwellError.
const optional = context.storeUser; // null for a visitor; no exception needed.
```

## Components

App components are small UI bundles from an app's `components/` folder. Swell renders each one in an isolated iframe on the app installation's origin, so app code never runs in the host page. `@swell/apps-sdk/components` is browser code and is only bundled when you import it.

### Writing a component

Components are Preact components. Import only the props type from the SDK:

```tsx
import type { ComponentProps } from '@swell/apps-sdk/components';

export const config = { description: 'Brand color picker' };

export default function ColorPicker({ value, setValue, readonly }: ComponentProps<string>) {
  return <input type="color" value={value} disabled={readonly} onInput={(e) => setValue(e.currentTarget.value)} />;
}
```

| Prop | Description |
| --- | --- |
| `value`, `setValue(value)` | The bound value, when the place provides one (for example a content field) |
| `context` | Data of the place: for a content field `{ record, field }` |
| `params` | Configuration from the place that uses the component |
| `settings` | The app's public settings |
| `locale`, `readonly` | Display locale and read-only state |
| `setValidity(error)` | Report a validation error, or `null` when valid |
| `fetch` | Like `fetch`, but requests to the app's own origin (app functions, `/app-api`) carry a platform token when the host provides one, so they receive a verified `Swell-Context` with `surface` |
| `on(event, handler)` | Handle a host event. Only the first handler registered for an event runs; its return value, or the error it throws, answers the host's `emit` |

### Rendering components

Hosts render installed apps' components with `createComponents`:

```ts
import { createComponents } from '@swell/apps-sdk/components';

const components = createComponents({ storeId: 'my-store', publicKey: 'pk_...' });

const badge = components.mount('#badge', {
  app: 'my_app',
  component: 'ProductBadge',
  context: { product },
});

badge.on('change', (value) => { /* … */ });
badge.on('error', (error) => { /* show that the component is unavailable */ });
badge.update({ context: { product: nextProduct } });

await badge.ready;
const result = await badge.emit('submit', data);
badge.unmount();
```

`mount` returns the handle right away and loads the app's component list in the background. It throws only when the target element does not exist.

| Handle | Description |
| --- | --- |
| `ready` | Resolves when the component has mounted in its frame. Rejects when the app or component cannot be loaded, when the frame page does not start within 10 seconds of loading, when the props cannot be sent, or when you unmount first |
| `on(event, handler)` | Listen to `change` (new value), `validity` (error or `null`) and `error` (load, start, token and component failures, including the ones that reject `ready`). Returns a function that removes the listener; other event names are ignored |
| `update(input)` | Re-render with new `value`, `context`, `params`, `readonly` or `locale`. Updates made before the component list loads are kept |
| `emit(event, data)` | Waits for `ready`, then resolves with the result of the component's first `on` handler for the event, or rejects with its error |
| `unmount()` | Removes the frame. Before the component list loads, it cancels the mount; `ready` and pending `emit` calls reject |

Props and event data must be structured-cloneable. Props that cannot be cloned fire `error`, and at mount they also reject `ready`; event data that cannot be cloned rejects that `emit` call.

Hosts that have their own session, like the Swell admin, pass `getToken: (app) => Promise<{ token, expires }>`. The token is refreshed a minute before it expires; if a refresh fails, the component keeps the current token and the host retries. Without `getToken` the frame gets no token, and `props.fetch` sends requests without a token header.

The frame lives in a body-level layer positioned over the target element, so styles on the target's ancestors (`transform`, `filter`, `overflow`) cannot break a modal the component opens. The layer mirrors what the target's containers do to it instead: it takes their opacity and the z-index of the outermost positioned ancestor that has one (so a component inside a fixed modal shows above the modal), is clipped to the visible part of scrolling ancestors, and hides while the target is `visibility: hidden`. The target's height follows the component's content.

Keyboard focus follows the page order: the mount target gets a focusable child (`tabindex="0"`, labelled with the component title) that stands in for the frame, and Tab and Shift+Tab move through the component and on to the neighbouring elements of your page. The child is a Tab stop only while the frame runs: Tab skips a component whose frame has not started yet, failed to start or reported an error before it rendered. The frame's layer carries `data-swell-component-layer`. A host focus trap, such as a modal that keeps Tab inside itself, must treat the layer (a body-level element outside the modal) as inside the trap.

Bars that cover scrolling content, such as a modal's sticky header or action bar, would otherwise be painted over by the layer. Mark them with `data-swell-component-occluder`:

```html
<div class="modal-header" data-swell-component-occluder>…</div>
```

The layer is clipped where such a bar overlaps the top or bottom edge of the target's visible part, so a component taller than its scroller passes under both a header and a footer. Only bars in the same stacking context as the target count: descendants of the element whose z-index the layer takes, or of `body` when no ancestor has one. Bars beside the target are ignored, and so are hidden bars: ones that are not displayed, and, in browsers with `Element.checkVisibility()`, ones that are `visibility: hidden` or have `opacity: 0`.

When keyboard focus moves to a control inside a component, the target's scrolling ancestors scroll it into view. On a scroller with sticky bars, set `scroll-padding` to the bars' height (for example `scroll-padding: 56px 0`), so the control stops clear of them.

Component frames load from the app installation's origin, a subdomain of `swell.store`. If the host page has a Content Security Policy, allow these origins in `frame-src`, for example `frame-src https://*.swell.store`.

## API reference

### Backend client

Pass `{ context }` for a frontend request, or explicit credentials for an external
server. Backend calls require an access token or secret key and an absolute HTTP(S)
`apiHost`. Do not mix input sources. Invalid constructor options throw immediately;
all backend methods return promises and reject on failure.

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

**Private functions:** use the app slug from `context.appId` and authorize the caller
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

For API response caching, replace `storefront.request` before first use. The SDK
leaves response caching to your application.

### Request context options

`verifySwellContext(headers, { env?, appId?, storeId?, vaultUrl? })` returns the request
context or throws if verification fails. Set `appId` and, for a single-store app,
`storeId` from trusted configuration to reject contexts intended for another app or
store. Without these options, it verifies the source but does not restrict the
destination. `vaultUrl` provides an optional vault endpoint override.

Configuration is read from `process.env`, or from `env` when supplied. Workers without
Node compatibility should pass their bindings as `env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SWELL_VERIFY_HEADERS` | enabled | Set exactly `"false"` to skip signature verification during local development. |
| `SWELL_HEADERS_JWKS_URL` | `https://keys.swell.store/jwks.json` | Override the verification-key endpoint. |

For local development against a local Swell instance, put `SWELL_VERIFY_HEADERS=false`
in `.dev.vars`. Remove it or set it to `"true"` to restore verification. Token structure
and claim validation still apply, but the context is no longer authenticated: anyone
who can reach the frontend directly can supply forged context, including a store user.
Use this bypass only for local development.

For server integrations, construct `SwellBackendAPI` with explicit credentials and
`createStorefrontClient` with explicit public configuration. These clients do not
require an HTTP request or a store user.

### Store users

`requireStoreUser(context)` returns `{ userId, storeId }` or throws `SwellError` with
status 401 and code `store_user_required`. For optional access, read
`context.storeUser`, which is null for visitors.

A store user is anyone signed in to the store's dashboard, including partners and Swell
support, who may not appear in the store's own user list. Swell's proxy handles their
authentication and write-origin checks; your application decides what each store user
may do.

### Errors

Import `SwellError` from the root package. Use `status` and optional `code`/`body` for
error handling; `message` is for people and may change.

- Structured backend errors retain their body; string errors have no body.
- HTTP-200 non-GET validation failures use status 400 and the `errors` field map as
  `body`. Successful GET responses containing `errors` are returned as data.
- Function invocation failures retain the response payload, or the invocation envelope
  when the payload is null or absent, in `body`.
- Header verification uses 401 / `invalid_swell_context` for absent, malformed, expired
  or rejected tokens, and 503 / `swell_jwks_unavailable` for key-service failures.
- Backend/storefront network errors remain native. Local configuration errors may be
  ordinary `Error` instances; not every failure is a `SwellError`.

## Development

```sh
npm ci
npm run verify
```

`verify` builds the SDK, runs unit tests and typechecks, then checks the packed package,
browser/Worker boundaries and workerd execution.

## License

[MIT](LICENSE)
