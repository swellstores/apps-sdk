import type { ComponentInput, ComponentToken } from './components-types.js';
import { tabbableIn } from './components-focus.js';
import { createFrameLayer } from './components-layer.js';
import { unwrap, wrap } from './components-protocol.js';
import type { FrameMessage, HostMessage, WireProps } from './components-protocol.js';

/** Controls one mounted component. */
export interface ComponentHandle<TValue = unknown> {
  /**
   * Resolves when the component has mounted in its frame. Rejects when the component cannot be
   * loaded or started, or is unmounted first; the `error` event fires as well.
   */
  readonly ready: Promise<void>;
  /** Listens to the component. Returns a function that removes the listener; unknown events are ignored. */
  on(event: 'change', handler: (value: TValue) => void): () => void;
  on(event: 'validity', handler: (error: string | null) => void): () => void;
  on(event: 'error', handler: (error: Error) => void): () => void;
  /** Re-renders the component with new data. */
  update(input: ComponentInput<TValue>): void;
  /** Sends an event to the component and resolves with its handler's result. */
  emit<T = unknown>(event: string, data?: unknown): Promise<T>;
  unmount(): void;
}

export interface EmbedOptions<TValue = unknown, TContext = Record<string, unknown>> extends ComponentInput<TValue, TContext> {
  /** Frame URL from the component metadata. */
  src: string;
  settings?: Record<string, unknown>;
  title?: string;
  getToken?: () => Promise<ComponentToken>;
}

type Listener = (value: never) => void;
type HandleEvent = 'change' | 'validity' | 'error';
// Set while one component hands focus to the next, so the next one enters at the nearest edge
let enteredFrom: 'first' | 'last' | null = null;
const REFRESH_SECONDS = 60;
const MIN_REFRESH_MS = 5_000;
const RETRY_MS = 10_000;
const MAX_RETRY_MS = 5 * 60_000;
const MAX_TIMEOUT = 2 ** 31 - 1;
const START_MS = 10_000;
const INPUT_KEYS = ['value', 'context', 'params', 'readonly', 'locale'] as const;

export const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** The props a handle update changes: only the keys the host passed. */
export function pickInput(input: ComponentInput<unknown, unknown>): Partial<WireProps> {
  const changed: Partial<WireProps> = {};
  for (const key of INPUT_KEYS) {
    if (key in input) Object.assign(changed, { [key]: input[key] });
  }
  return changed;
}

/** Handle event listeners. Unknown event names subscribe to nothing. */
export function createListeners() {
  const sets = new Map<string, Set<Listener>>([['change', new Set()], ['validity', new Set()], ['error', new Set()]]);
  return {
    on(event: string, handler: Listener) {
      const set = sets.get(event);
      set?.add(handler);
      return () => {
        set?.delete(handler);
      };
    },
    notify(event: HandleEvent, value: unknown) {
      for (const handler of sets.get(event) ?? []) (handler as (value: unknown) => void)(value);
    },
  };
}

/** A promise with its settle functions. Rejections are handled, so an unobserved one is not reported. */
export function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

/** Embeds a component frame over `placeholder`. Internal: hosts use createComponents().mount(). */
export function embedComponent<TValue = unknown, TContext = Record<string, unknown>>(placeholder: HTMLElement, options: EmbedOptions<TValue, TContext>): ComponentHandle<TValue> {
  const window = placeholder.ownerDocument.defaultView;
  if (!window) throw new Error('Component placeholder must be attached to a window');
  const channel = crypto.randomUUID();
  const url = new URL(options.src);
  url.searchParams.set('parent', window.location.origin);
  url.searchParams.set('channel', channel);
  const frameOrigin = url.origin;
  const props: WireProps = {
    value: options.value, context: options.context ?? {}, params: options.params ?? {},
    settings: options.settings ?? {}, locale: options.locale ?? 'en', readonly: options.readonly ?? false,
  };
  const { on, notify } = createListeners();
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let calls = 0;
  let token: string | null = null;
  let tokenTimer: ReturnType<typeof setTimeout> | undefined;
  let tokenFailures = 0;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let greeted = false;
  let started = false;
  let destroyed = false;
  let overlayOn = false;
  const { promise: ready, resolve: markReady, reject: failReady } = deferred();

  const fail = (error: unknown) => {
    const reported = toError(error);
    notify('error', reported);
    return reported;
  };
  const rejectPending = (error: Error) => {
    for (const call of pending.values()) call.reject(error);
    pending.clear();
  };
  const layer = createFrameLayer(placeholder, url.href, options.title ?? 'App component', rect => send({ type: 'rect', rect }));

  // The frame sits at the end of the body, so Tab and screen readers meet a sentinel in the placeholder instead
  const sentinel = placeholder.ownerDocument.createElement('div');
  sentinel.tabIndex = 0;
  sentinel.setAttribute('role', 'group');
  sentinel.setAttribute('aria-label', options.title ?? 'App component');
  Object.assign(sentinel.style, { display: 'block', width: '0', height: '0', overflow: 'hidden', outline: 'none' });
  placeholder.appendChild(sentinel);
  sentinel.addEventListener('focus', (event) => {
    const from = (event as FocusEvent).relatedTarget as Node | null;
    layer.iframe.focus();
    const edge = enteredFrom ?? (from && sentinel.compareDocumentPosition(from) & sentinel.DOCUMENT_POSITION_FOLLOWING ? 'last' : 'first');
    send({ type: 'focus', edge });
  });

  // Moves focus to the tabbable element after (next) or before (previous) the placeholder
  function leaveFrame(direction: 'next' | 'previous') {
    const document = placeholder.ownerDocument;
    if (overlayOn || document.activeElement !== layer.iframe) return;
    const side = direction === 'next' ? sentinel.DOCUMENT_POSITION_FOLLOWING : sentinel.DOCUMENT_POSITION_PRECEDING;
    const candidates = tabbableIn(document).filter(item => item !== sentinel && !placeholder.contains(item) && sentinel.compareDocumentPosition(item) & side);
    const target = candidates[direction === 'next' ? 0 : candidates.length - 1];
    if (!target) return layer.iframe.blur();
    // A neighbouring component's sentinel reads this to focus the edge we came from
    enteredFrom = direction === 'next' ? 'first' : 'last';
    try {
      target.focus();
    } finally {
      enteredFrom = null;
    }
  }

  // Throws when the message cannot be cloned
  function post(message: HostMessage) {
    if (started && !destroyed) layer.iframe.contentWindow?.postMessage(wrap(channel, message), frameOrigin);
  }

  function send(message: HostMessage) {
    try {
      post(message);
    } catch (error) {
      fail(error);
    }
  }

  // A failed refresh keeps the current token, which can still be valid, and retries with backoff
  async function loadToken() {
    if (!options.getToken || destroyed) return;
    let next: ComponentToken | undefined;
    let error: unknown;
    try {
      next = await options.getToken();
      if (!next || typeof next.token !== 'string' || !Number.isFinite(next.expires)) {
        throw new TypeError('getToken must resolve to { token: string, expires: number }');
      }
    } catch (caught) {
      next = undefined;
      error = caught;
    }
    if (destroyed) return;
    const delay = next
      ? Math.max(MIN_REFRESH_MS, (next.expires - REFRESH_SECONDS) * 1000 - Date.now())
      : Math.min(MAX_RETRY_MS, RETRY_MS * 2 ** tokenFailures);
    tokenFailures = next ? 0 : tokenFailures + 1;
    tokenTimer = setTimeout(() => void loadToken(), Math.min(MAX_TIMEOUT, delay));
    if (next) {
      token = next.token;
      send({ type: 'token', token });
    } else {
      fail(error);
    }
  }
  const tokenLoaded = loadToken();

  // A frame page that never says hello (404, CSP, frame-ancestors) fails ready instead of leaving it pending
  layer.iframe.addEventListener('load', () => {
    if (greeted || destroyed) return;
    clearTimeout(startTimer);
    startTimer = setTimeout(() => {
      if (!greeted && !destroyed) failReady(fail(new Error('Component frame did not start')));
    }, START_MS);
  });

  async function onMessage(event: MessageEvent) {
    if (event.origin !== frameOrigin || event.source !== layer.iframe.contentWindow) return;
    const message = unwrap<FrameMessage>(event.data, channel);
    if (!message) return;
    switch (message.type) {
      case 'hello':
        clearTimeout(startTimer);
        if (greeted) {
          // The frame reloaded: its new runtime starts without overlay and cannot answer earlier events
          layer.setOverlay(false);
          overlayOn = false;
          rejectPending(new Error('Component reloaded'));
        }
        greeted = true;
        await tokenLoaded;
        started = true;
        try {
          post({ type: 'init', props, token });
        } catch (error) {
          failReady(fail(error));
        }
        return;
      case 'ready':
        markReady();
        return;
      case 'change':
        notify('change', message.value);
        return;
      case 'validity':
        notify('validity', typeof message.error === 'string' ? message.error : null);
        return;
      case 'resize':
        if (Number.isFinite(message.height)) layer.setHeight(Math.max(0, Math.ceil(message.height)));
        return;
      case 'overlay':
        overlayOn = message.on === true;
        send({ type: 'rect', rect: layer.setOverlay(message.on === true) });
        return;
      case 'focus-exit':
        if (message.direction === 'next' || message.direction === 'previous') leaveFrame(message.direction);
        return;
      case 'result': {
        const call = pending.get(message.call);
        if (!call) return;
        pending.delete(message.call);
        if (typeof message.error === 'string') call.reject(new Error(message.error));
        else call.resolve(message.result);
        return;
      }
      case 'error': {
        const error = new Error(String(message.message));
        failReady(error);
        fail(error);
        return;
      }
    }
  }
  window.addEventListener('message', onMessage);

  return {
    ready,
    on,
    update(input) {
      const changed = pickInput(input);
      Object.assign(props, changed);
      send({ type: 'update', props: changed });
    },
    async emit<T = unknown>(name: string, data?: unknown): Promise<T> {
      await ready;
      if (destroyed) throw new Error('Component unmounted');
      const call = ++calls;
      const result = new Promise<T>((resolve, reject) => {
        pending.set(call, { resolve: resolve as (value: unknown) => void, reject });
      });
      try {
        post({ type: 'event', call, name, data });
      } catch (error) {
        pending.delete(call);
        throw error;
      }
      return result;
    },
    unmount() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(tokenTimer);
      clearTimeout(startTimer);
      rejectPending(new Error('Component unmounted'));
      failReady(new Error('Component unmounted'));
      layer.destroy();
      sentinel.remove();
    },
  };
}
