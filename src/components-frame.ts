import type { ComponentModule, ComponentProps } from './components-types.js';
import { TOKEN_HEADER, unwrap, wrap } from './components-protocol.js';
import type { FrameMessage, HostMessage, Rect, WireProps } from './components-protocol.js';

export interface FrameOptions {
  /** URL of the component bundle: an ES module exporting mount, update and unmount. */
  bundleUrl: string;
  /** Render target. Defaults to #root, created when missing. */
  root?: HTMLElement;
  /** Test seam: the frame window. */
  window?: Window & typeof globalThis;
  /** Test seam: the host window. Defaults to window.parent. */
  parent?: Pick<Window, 'postMessage'>;
  /** Test seam: loads the bundle. */
  importModule?: (url: string) => Promise<unknown>;
}

const BASE_STYLE = 'html,body{margin:0;padding:0;background:transparent}';

function isModule(value: unknown): value is ComponentModule {
  const module = value as Partial<ComponentModule> | null;
  return !!module && typeof module.mount === 'function' && typeof module.update === 'function' && typeof module.unmount === 'function';
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Runs inside the component frame: connects to the host page and renders the component bundle. */
export function startComponentFrame(options: FrameOptions): void {
  const win = options.window ?? window;
  const parent = options.parent ?? win.parent;
  const params = new URLSearchParams(win.location.search);
  const parentOrigin = params.get('parent');
  const channel = params.get('channel');
  if (!parentOrigin || !channel || parent === win) throw new Error('App component frames must be embedded by a Swell host');
  const document = win.document;
  const style = document.createElement('style');
  style.textContent = BASE_STYLE;
  document.head.appendChild(style);
  let root = options.root ?? document.getElementById('root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  }
  const target: HTMLElement = root;
  const importModule = options.importModule ?? ((url: string) => import(/* webpackIgnore: true */ /* @vite-ignore */ url));

  let props: WireProps | null = null;
  let token: string | null = null;
  let module: ComponentModule | null = null;
  let overlay = false;
  let lastHeight = -1;
  let scheduled = 0;
  const handlers = new Map<string, ((data: unknown) => unknown)[]>();

  const post = (message: FrameMessage) => parent.postMessage(wrap(channel, message), parentOrigin);
  const fail = (error: unknown) => post({ type: 'error', message: errorMessage(error) });

  // The token only goes to the app origin (functions, /app-api), never to third parties.
  const fetchWithToken: typeof fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), win.location.href);
    if (!token || url.origin !== win.location.origin) return win.fetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(TOKEN_HEADER, token);
    return win.fetch(input, { ...init, headers });
  };

  const componentProps = () => ({
    ...(props as WireProps),
    setValue: (value: unknown) => post({ type: 'change', value }),
    setValidity: (error: string | null) => post({ type: 'validity', error: typeof error === 'string' ? error : null }),
    fetch: fetchWithToken,
    on(event: string, handler: (data: unknown) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return () => {
        handlers.set(event, (handlers.get(event) ?? []).filter(item => item !== handler));
      };
    },
  }) as ComponentProps;

  const reportHeight = () => {
    if (overlay) return;
    const height = Math.ceil(target.getBoundingClientRect().height);
    if (height !== lastHeight) {
      lastHeight = height;
      post({ type: 'resize', height });
    }
  };

  const placeRoot = (rect: Rect) => Object.assign(target.style, { position: 'absolute', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px` });

  const setOverlay = (on: boolean) => {
    if (overlay === on) return;
    overlay = on;
    document.documentElement.style.overflow = on ? 'hidden' : '';
    post({ type: 'overlay', on });
    if (!on) {
      Object.assign(target.style, { position: '', top: '', left: '', width: '' });
      lastHeight = -1;
      reportHeight();
    }
  };

  // An SDK opened a modal: a fixed element covering the frame viewport (Stripe 3DS, QR codes, vendor modals).
  const isBlocking = (element: Element) => {
    if (element === target || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return false;
    const computed = win.getComputedStyle(element);
    if (computed.position !== 'fixed' || computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') return false;
    const box = element.getBoundingClientRect();
    return box.width >= win.innerWidth * 0.9 && box.height >= win.innerHeight * 0.9;
  };

  new win.MutationObserver(() => {
    win.cancelAnimationFrame(scheduled);
    scheduled = win.requestAnimationFrame(() => setOverlay(Array.from(document.body.children).some(isBlocking)));
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

  new win.ResizeObserver(reportHeight).observe(target);

  let loading: Promise<ComponentModule> | null = null;

  // One import per frame: an init that arrives while the bundle loads waits for the same import
  const loadModule = () => {
    loading ??= importModule(options.bundleUrl).then((loaded) => {
      if (!isModule(loaded)) throw new Error('Component bundle must export mount, update and unmount');
      return loaded;
    });
    return loading;
  };

  async function handle(message: HostMessage) {
    switch (message.type) {
      case 'init': {
        props = message.props;
        token = message.token;
        const loaded = await loadModule();
        if (module) {
          module.update(target, componentProps());
          return;
        }
        // Mount with the latest props: updates may have arrived while the bundle loaded
        loaded.mount(target, componentProps());
        module = loaded;
        post({ type: 'ready' });
        reportHeight();
        return;
      }
      case 'update':
        if (!props) return;
        props = { ...props, ...message.props };
        module?.update(target, componentProps());
        return;
      case 'token':
        token = message.token;
        return;
      case 'event': {
        const [handler] = handlers.get(message.name) ?? [];
        try {
          post({ type: 'result', call: message.call, result: handler ? await handler(message.data) : undefined });
        } catch (error) {
          post({ type: 'result', call: message.call, error: errorMessage(error) });
        }
        return;
      }
      case 'rect':
        if (overlay) placeRoot(message.rect);
        return;
    }
  }

  win.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    const message = unwrap<HostMessage>(event.data, channel);
    if (message) handle(message).catch(fail);
  });

  post({ type: 'hello' });
}
