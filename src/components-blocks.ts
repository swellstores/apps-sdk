// The host of `component` storefront app blocks (the app block standard v1, 4.5): each block's App Component mounts in
// a frame on its app's installation origin, now and whenever its element is added (a cart drawer), with the block's
// props as params and the storefront and theme tokens as context; it unmounts when the element leaves the page, and
// mounts again when its props change. The fallback stays until the frame is ready, then the host hides it.
import { createComponents } from './components-client.js';
import type { ComponentHandle } from './components-host.js';
import type { ComponentToken } from './components-types.js';

/** The theme tokens a host passes as `context.tokens` (the standard's --swell-* custom properties, without the prefix). */
export const BLOCK_TOKENS = Object.freeze(['color-text', 'color-muted', 'color-background', 'color-surface', 'color-accent', 'color-on-accent', 'color-border', 'font-body', 'font-heading', 'radius', 'space']);

export interface ComponentBlocksOptions {
  storeId: string;
  /** For the SDK's component list. A placeholder when `url` names the host's own list route, which reads with its key. */
  publicKey: string;
  /** Base of the component list (`<url>/api/apps/<app>/components`). Defaults to the store's storefront API. */
  url?: string;
  /** The block's component token (a storefront host fetches `/.swell/component-token?app=<app>`). */
  getToken: (app: string) => Promise<ComponentToken>;
  /** The page's `component` blocks by `"<app>/<block>"`: the component and the frame's accessible title. */
  blocks: Readonly<Record<string, { component: string; title: string }>>;
  /** `context.storefront`, as `script` blocks get it. */
  storefront: Readonly<Record<string, unknown>>;
  /** The mount element's id attribute (default `data-app-block`). */
  attribute?: string;
  /** Set on a mount element once its frame is ready (default `data-app-frame-ready`): hide the fallback with it. */
  readyAttribute?: string;
  /** Class of the element the frame mounts in, appended to the mount element (default `swell-app-frame`). */
  frameClass?: string;
  /** The document (default: the global one). */
  document?: Document;
}

/**
 * Mounts the page's `component` blocks, and keeps them in step with the page. A `script` block (not in `blocks`) is
 * left alone. Returns a function that stops and unmounts every block.
 */
export function startComponentBlocks(options: ComponentBlocksOptions): () => void {
  const doc = options.document ?? document;
  const win = doc.defaultView;
  if (!win) throw new Error('startComponentBlocks needs a document with a window');
  const attribute = options.attribute ?? 'data-app-block';
  const ready = options.readyAttribute ?? 'data-app-frame-ready';
  const frameClass = options.frameClass ?? 'swell-app-frame';
  const selector = `[${attribute}][data-app-props]`;
  const components = createComponents({ storeId: options.storeId, publicKey: options.publicKey, url: options.url, getToken: options.getToken });
  const mounted = new Map<HTMLElement, { props: string; handle: ComponentHandle<unknown>; frame: HTMLElement }>();

  const tokens = (el: HTMLElement) => {
    const style = win.getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const t of BLOCK_TOKENS) {
      const v = style.getPropertyValue(`--swell-${t}`).trim();
      if (v) out[t] = v;
    }
    return out;
  };
  const unmount = (el: HTMLElement) => {
    const m = mounted.get(el);
    if (!m) return;
    mounted.delete(el);
    el.removeAttribute(ready);
    m.handle.unmount();
    m.frame.remove();
  };
  const mount = (el: HTMLElement) => {
    const raw = el.getAttribute('data-app-props') ?? '';
    const was = mounted.get(el);
    if (was && was.props === raw) return;
    if (was) unmount(el);
    const id = el.getAttribute(attribute) ?? '';
    const block = Object.prototype.hasOwnProperty.call(options.blocks, id) ? options.blocks[id] : undefined;
    if (!block || id.indexOf('/') < 1) return;
    let params: unknown;
    try {
      params = JSON.parse(raw);
    } catch {
      return;
    }
    if (!params || typeof params !== 'object' || Array.isArray(params)) return;
    const frame = doc.createElement('div');
    frame.className = frameClass;
    el.append(frame);
    const handle = components.mount(frame, {
      app: id.slice(0, id.indexOf('/')),
      component: block.component,
      title: block.title,
      params: params as Record<string, unknown>,
      context: { storefront: options.storefront, tokens: tokens(el) },
    });
    const entry = { props: raw, handle, frame };
    mounted.set(el, entry);
    handle.ready.then(
      () => {
        if (mounted.get(el) === entry) el.setAttribute(ready, '');
      },
      () => {
        // it couldn't load or start, or left the page: the fallback stays
        if (mounted.get(el) === entry) unmount(el);
      },
    );
  };
  const scan = () => {
    doc.querySelectorAll<HTMLElement>(selector).forEach(mount);
    for (const el of [...mounted.keys()]) if (!el.isConnected || !el.matches(selector)) unmount(el);
  };
  scan();
  const observer = new win.MutationObserver(scan);
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-app-props', attribute] });
  return () => {
    observer.disconnect();
    for (const el of [...mounted.keys()]) unmount(el);
  };
}
