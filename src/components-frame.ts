import type { ComponentModule, ComponentProps } from './components-types.js';
import { tabbableIn } from './components-focus.js';
import { TOKEN_HEADER, unwrap, wrap } from './components-protocol.js';
import type { FrameMessage, HostMessage, Rect, WireProps } from './components-protocol.js';

export interface FrameOptions {
  /** URL of the component bundle: an ES module exporting mount, update and unmount. Relative URLs resolve against the frame page. */
  bundleUrl: string;
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

/** Runs inside the component frame: connects to the host page and renders the component bundle. */
export function startComponentFrame(options: FrameOptions): void {
  const win = options.window ?? window;
  const parent = options.parent ?? win.parent;
  const params = new URLSearchParams(win.location.search);
  const parentOrigin = params.get('parent');
  const channel = params.get('channel');
  if (!parentOrigin || !channel || parent === win) throw new Error('App component frames must be embedded by a Swell host');
  const bundleUrl = new URL(options.bundleUrl, win.location.href).href;
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
  let mounting: Promise<void> | null = null;
  let overlay = false;
  let lastHeight = -1;
  let scheduled = 0;
  let mayTurnOn = false;
  // The viewport-covering element while overlay is on
  let blocker: Element | null = null;
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

  // Created once, so the component gets the same functions on every render
  const callbacks = {
    setValue: (value: unknown) => post({ type: 'change', value }),
    setValidity: (error: string | null) => post({ type: 'validity', error: typeof error === 'string' ? error : null }),
    fetch: fetchWithToken,
    on(event: string, handler: (data: unknown) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return () => {
        handlers.set(event, (handlers.get(event) ?? []).filter(item => item !== handler));
      };
    },
  };
  const componentProps = () => ({ ...(props as WireProps), ...callbacks }) as ComponentProps;

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
      placeGuards();
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
    loading ??= importModule(bundleUrl).then((loaded) => {
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
        props = message.props;
        token = message.token;
        if (!mounting) {
          mounting = mount();
          return mounting;
        }
        await mounting;
        await module?.update(target, componentProps());
        return;
      case 'update':
        if (!props) return;
        props = { ...props, ...message.props };
        await module?.update(target, componentProps());
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
      case 'focus':
        enter(message.edge);
        return;
    }
  }

  // Tab leaving the component continues in the host page: focus guards around the root catch it
  let awaitingEntry = false;
  // Set around our own focus() calls: the focus events they cause must not move focus again
  let moving = false;
  const focusQuietly = (element: HTMLElement) => {
    const was = moving;
    moving = true;
    try {
      element.focus();
    } finally {
      moving = was;
    }
  };
  const guard = (direction: 'next' | 'previous') => {
    const element = document.createElement('div');
    element.tabIndex = 0;
    element.setAttribute('data-swell-focus-guard', '');
    element.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:0;overflow:hidden;outline:none';
    element.addEventListener('focus', () => {
      if (moving) return;
      if (overlay) {
        // The frame covers the viewport: keep focus inside the element that covers it, never on the root under it
        const stops = tabbableIn(blocker ?? document.body);
        const stop = stops[direction === 'previous' ? stops.length - 1 : 0];
        if (stop) focusQuietly(stop);
      } else if (awaitingEntry) {
        // Tab came before the host's focus message: enter at this guard's own edge
        enter(direction === 'previous' ? 'first' : 'last');
      } else {
        post({ type: 'focus-exit', direction });
      }
    });
    // Right after a fallback entry the guard holds focus, so the very next Tab out of the component lands on it again
    element.addEventListener('keydown', (event) => {
      if (overlay || event.key !== 'Tab' || event.shiftKey !== (direction === 'previous')) return;
      event.preventDefault();
      post({ type: 'focus-exit', direction });
    });
    return element;
  };
  const guards = { previous: guard('previous'), next: guard('next') };
  target.before(guards.previous);
  target.after(guards.next);

  // Overlay modals are body children after the root, so the guards move around them: the one before the modal
  // catches Shift+Tab from its first control, the one at the end of the body Tab from its last
  function placeGuards() {
    const { body } = document;
    if (overlay && blocker) {
      if (blocker.previousElementSibling !== guards.previous) blocker.before(guards.previous);
      if (body.lastElementChild !== guards.next) body.append(guards.next);
    } else if (!overlay) {
      if (target.previousElementSibling !== guards.previous) target.before(guards.previous);
      if (target.nextElementSibling !== guards.next) target.after(guards.next);
    }
  }

  // Focus enters at an edge. A component whose controls we cannot see (closed shadow roots) is entered through the guard on that side.
  function enter(edge: 'first' | 'last') {
    awaitingEntry = false;
    const stops = tabbableIn(target);
    const stop = stops[edge === 'last' ? stops.length - 1 : 0];
    if (stop) focusQuietly(stop);
    else if (Array.from(target.querySelectorAll('*')).some(element => element.localName.includes('-'))) {
      focusQuietly(guards[edge === 'first' ? 'previous' : 'next']);
    } else post({ type: 'focus-exit', direction: edge === 'last' ? 'previous' : 'next' });
  }
  // Entry is pending when the frame gains focus with nothing focused in it, unless focus went into a nested frame
  // (in the root or in an overlay modal, such as a 3DS challenge): it comes back from there with nothing focused
  // too, and must not enter again. A pointer press gives the frame focus as well, after pointerdown: no entry either.
  let intoFrame = false;
  let pressed = false;
  win.addEventListener('blur', () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    intoFrame = active?.localName === 'iframe';
    pressed = false;
  });
  win.addEventListener('focus', () => {
    const none = !document.activeElement || document.activeElement === document.body;
    awaitingEntry = none && !intoFrame && !pressed;
    intoFrame = pressed = false;
  });
  document.addEventListener('pointerdown', () => {
    awaitingEntry = false;
    pressed = true;
  }, true);
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof win.Element && !event.target.hasAttribute('data-swell-focus-guard')) awaitingEntry = false;
  });

  win.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    const message = unwrap<HostMessage>(event.data, channel);
    if (message) handle(message).catch(fail);
  });

  post({ type: 'hello' });
}
