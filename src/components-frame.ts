import type { ComponentModule, ComponentProps, ComponentTheme } from './components-types.js';
import { firstTabbable } from './components-focus.js';
import { TOKEN_HEADER, unwrap, wrap } from './components-protocol.js';
import type { FrameMessage, HostMessage, Rect, WireProps } from './components-protocol.js';

export interface FrameOptions {
  /**
   * URL of the component bundle: an ES module exporting mount, update and unmount. Relative URLs resolve against the
   * frame page. Without it the frame asks the platform: `<page path>.json` answers `{ bundleUrl }` for the build the
   * installation runs, as the platform's shell page (`component-frame.html`) expects.
   */
  bundleUrl?: string;
  /** Render target. Defaults to #root, created when missing. */
  root?: HTMLElement;
  /** @internal Test seam: the frame window. */
  window?: Window & typeof globalThis;
  /** @internal Test seam: the host window. Defaults to window.parent. */
  parent?: Pick<Window, 'postMessage'>;
  /** @internal Test seam: loads the bundle. */
  importModule?: (url: string) => Promise<unknown>;
}

// #root is a flow root, so its children's margins count in the height reported to the host
const BASE_STYLE = 'html,body{margin:0;padding:0;background:transparent}#root{display:flow-root}';

function isModule(value: unknown): value is ComponentModule {
  const module = value as Partial<ComponentModule> | null;
  return !!module && typeof module.mount === 'function' && typeof module.update === 'function' && typeof module.unmount === 'function';
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Only the platform knows which build the installation runs, so it answers next to the shell page
async function fetchBundleUrl(win: Window & typeof globalThis): Promise<string> {
  const response = await win.fetch(new URL(`${win.location.pathname}.json`, win.location.href).href, { headers: { Accept: 'application/json' } });
  if (response.status === 404) throw new Error('Component not found');
  if (!response.ok) throw new Error(`Component metadata failed (${response.status})`);
  const { bundleUrl } = (await response.json()) as { bundleUrl?: unknown };
  if (typeof bundleUrl !== 'string' || !bundleUrl) throw new Error('Component metadata has no bundle URL');
  return new URL(bundleUrl, win.location.href).href;
}

/** Runs inside the component frame: connects to the host page and renders the component bundle. */
export function startComponentFrame(options: FrameOptions = {}): void {
  const win = options.window ?? window;
  const parent = options.parent ?? win.parent;
  const params = new URLSearchParams(win.location.search);
  const parentOrigin = params.get('parent');
  const channel = params.get('channel');
  if (!parentOrigin || !channel || parent === win) throw new Error('App component frames must be embedded by a Swell host');
  // Asked right away, so the answer arrives while the host handshake runs; a failure is reported when the bundle loads
  const bundleUrl = options.bundleUrl !== undefined
    ? Promise.resolve(new URL(options.bundleUrl, win.location.href).href)
    : fetchBundleUrl(win);
  bundleUrl.catch(() => {});
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

  // The frame shows the theme from its start: the host puts it in the frame's URL, which keeps the current one
  // for a reload
  let rootTheme: ComponentTheme | undefined;
  const showTheme = (theme: ComponentTheme) => {
    if (theme === rootTheme) return;
    rootTheme = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const url = new URL(win.location.href);
    url.searchParams.set('theme', theme);
    win.history.replaceState(win.history.state, '', url.href);
  };
  showTheme(params.get('theme') === 'dark' ? 'dark' : 'light');
  const importModule = options.importModule ?? ((url: string) => import(/* webpackIgnore: true */ /* @vite-ignore */ url));

  let props: WireProps | null = null;
  let token: string | null = null;
  let module: ComponentModule | null = null;
  let mounting: Promise<void> | null = null;
  let overlay = false;
  let lastHeight = -1;
  let scheduled = 0;
  let mayTurnOn = false;
  // The viewport-covering element while overlay is on
  let blocker: Element | null = null;
  const handlers = new Map<string, ((data: unknown) => unknown)[]>();
  // Host actions announced in init, and calls waiting for their reply
  let actions: string[] = [];
  let calls = 0;
  const replies = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

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

  // Created once, so the component gets the same functions on every render
  const callbacks = {
    // The component sees its own value before the next event; hosts only send values that change
    // elsewhere. The re-render runs in a microtask, so setValue during a render does not re-enter it
    setValue: (value: unknown) => {
      if (props) {
        props = { ...props, value };
        Promise.resolve().then(() => module?.update(target, componentProps())).catch(fail);
      }
      post({ type: 'change', value });
    },
    setValidity: (error: string | null) => post({ type: 'validity', error: typeof error === 'string' ? error : null }),
    fetch: fetchWithToken,
    on(event: string, handler: (data: unknown) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return () => {
        handlers.set(event, (handlers.get(event) ?? []).filter(item => item !== handler));
      };
    },
    call<T = unknown>(name: string, data?: unknown): Promise<T> {
      if (!actions.includes(name)) return Promise.reject(new Error(`Unknown host action "${name}"`));
      const call = ++calls;
      return new Promise<T>((resolve, reject) => {
        replies.set(call, { resolve: resolve as (value: unknown) => void, reject });
        post({ type: 'call', call, name, data });
      });
    },
  };
  const componentProps = () => ({ ...(props as WireProps), ...callbacks }) as ComponentProps;

  // A host before themes sends none: its pages are light
  const applyTheme = () => {
    if (!props) return;
    props = { ...props, theme: props.theme === 'dark' ? 'dark' : 'light' };
    showTheme(props.theme);
  };

  // At least 1px, so a modal opened from an empty component has an area: in a frame without height a modal has
  // none either, and overlay could not tell it from an empty fixed container
  const reportHeight = () => {
    if (overlay) return;
    const height = Math.max(1, Math.ceil(target.getBoundingClientRect().height));
    if (height !== lastHeight) {
      lastHeight = height;
      post({ type: 'resize', height });
    }
  };

  const placeRoot = (rect: Rect) => Object.assign(target.style, { position: 'absolute', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px` });

  const focusModal = () => blocker && firstTabbable(blocker as HTMLElement)?.focus();

  const setOverlay = (on: boolean) => {
    if (overlay === on) return;
    overlay = on;
    // The component's own controls are under the modal's backdrop: out of the Tab order and the pointer's reach
    if (on) target.setAttribute('inert', '');
    else target.removeAttribute('inert');
    // The modal takes focus from the component under it, or when nothing has focus, unless it took focus itself
    const active = document.activeElement;
    if (on && (!active || active === document.body || target.contains(active))) focusModal();
    document.documentElement.style.overflow = on ? 'hidden' : '';
    post({ type: 'overlay', on });
    if (!on) {
      Object.assign(target.style, { position: '', top: '', left: '', width: '' });
      lastHeight = -1;
      reportHeight();
    }
  };

  // An SDK opened a modal: a fixed element covering the frame viewport (Stripe 3DS, QR codes, vendor modals).
  // An element without area covers nothing, even while the frame itself is zero high.
  const isBlocking = (element: Element) => {
    if (element === target || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return false;
    const computed = win.getComputedStyle(element);
    if (computed.position !== 'fixed' || computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.width >= win.innerWidth * 0.9 && box.height >= win.innerHeight * 0.9;
  };

  // DOM changes can switch overlay on and off. A frame resize can only switch it off: overlay itself
  // resizes the frame, and an element that covers only the small frame would otherwise flip it forever.
  const detectOverlay = (turnOn: boolean) => {
    mayTurnOn ||= turnOn;
    win.cancelAnimationFrame(scheduled);
    scheduled = win.requestAnimationFrame(() => {
      blocker = Array.from(document.body.children).find(isBlocking) ?? null;
      if (mayTurnOn || !blocker) setOverlay(!!blocker);
      mayTurnOn = false;
    });
  };

  // The frame moves the root itself during overlay; that is no new modal
  new win.MutationObserver((records) => {
    if (records.some(record => record.target !== target || record.type !== 'attributes')) detectOverlay(true);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  win.addEventListener('resize', () => detectOverlay(false));

  new win.ResizeObserver(reportHeight).observe(target);

  let loading: Promise<ComponentModule> | null = null;

  // One import per frame: an init that arrives while the bundle loads waits for the same import
  const loadModule = () => {
    loading ??= bundleUrl.then(importModule).then((loaded) => {
      if (!isModule(loaded)) throw new Error('Component bundle must export mount, update and unmount');
      return loaded;
    });
    return loading;
  };

  // Mounts with the latest props (updates may arrive while the bundle loads) and reports ready once mount resolves
  async function mount() {
    const loaded = await loadModule();
    const mountedProps = props;
    await loaded.mount(target, componentProps());
    module = loaded;
    if (props !== mountedProps) await loaded.update(target, componentProps());
    post({ type: 'ready' });
    reportHeight();
  }

  async function handle(message: HostMessage) {
    switch (message.type) {
      case 'init':
        actions = Array.isArray(message.actions) ? message.actions.filter(name => typeof name === 'string') : [];
        props = message.props;
        applyTheme();
        token = message.token;
        if (!mounting) {
          mounting = mount();
          return mounting;
        }
        await mounting;
        await module?.update(target, componentProps());
        return;
      case 'reply': {
        const pending = replies.get(message.call);
        if (!pending) return;
        replies.delete(message.call);
        if (typeof message.error === 'string') pending.reject(new Error(message.error));
        else pending.resolve(message.result);
        return;
      }
      case 'update':
        if (!props) return;
        props = { ...props, ...message.props };
        applyTheme();
        await module?.update(target, componentProps());
        return;
      case 'token':
        token = message.token;
        return;
      case 'event': {
        // The handlers registered when the event arrived, in order, each after the previous one settles; one
        // removed meanwhile, as a re-render's effect cleanup does, no longer runs
        try {
          let result: unknown;
          for (const handler of handlers.get(message.name) ?? []) {
            if (!handlers.get(message.name)?.includes(handler)) continue;
            const value = await handler(message.data);
            if (value !== undefined) result = value;
          }
          post({ type: 'result', call: message.call, result });
        } catch (error) {
          post({ type: 'result', call: message.call, error: errorMessage(error) });
        }
        return;
      }
      case 'rect':
        if (overlay) placeRoot(message.rect);
        return;
      case 'focus':
        // During overlay the modal takes focus, never the component under its backdrop
        if (overlay) focusModal();
        else firstTabbable(target)?.focus();
        return;
    }
  }

  win.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    const message = unwrap<HostMessage>(event.data, channel);
    if (message) handle(message).catch(fail);
  });

  post({ type: 'hello', themes: true });
}
