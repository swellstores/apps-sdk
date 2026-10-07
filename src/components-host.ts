import type { ComponentInput, ComponentToken } from './components-types.js';
import { placeFrame } from './components-placement.js';
import { unwrap, wrap } from './components-protocol.js';
import type { FrameMessage, HostMessage, WireProps } from './components-protocol.js';

/** Controls one mounted component. */
export interface ComponentHandle<TValue = unknown> {
  /**
   * Resolves when the component has mounted in its frame. Rejects when the component cannot be
   * loaded or started; the `error` event fires as well. `unmount` also rejects it, without an
   * `error` event. A frame `error` is final: a later `ready` from that frame does not revive the
   * handle. A frame that only missed the 10 s start timeout can still start later and then serves `emit`.
   */
  readonly ready: Promise<void>;
  /**
   * Listens to the component. Returns a function that removes the listener; unknown events are ignored.
   * A listener that throws is caught and logged with `console.error`; the other listeners still run.
   */
  on(event: 'change', handler: (value: TValue) => void): () => void;
  on(event: 'validity', handler: (error: string | null) => void): () => void;
  on(event: 'error', handler: (error: Error) => void): () => void;
  /** Re-renders the component with new data. */
  update(input: ComponentInput<TValue>): void;
  /**
   * Sends an event to the component and resolves with its handler's result. Rejects when the frame
   * does not start in time, reports an error (final) or is unmounted.
   */
  emit<T = unknown>(event: string, data?: unknown): Promise<T>;
  /**
   * Moves keyboard focus to the component's first control, as a form does for its first invalid field.
   * During overlay, to the component's modal. A component without controls keeps focus on its frame.
   */
  focus(): void;
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
      for (const handler of sets.get(event) ?? []) {
        // A throwing listener must not stop the others or break the failure path that notified it
        try {
          (handler as (value: unknown) => void)(value);
        } catch (error) {
          console.error(error);
        }
      }
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

// randomUUID exists only in secure contexts; hosts served over plain http (local development) still get
// a random channel
function randomChannel(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Embeds a component frame over `placeholder`. Internal: hosts use createComponents().mount(). */
export function embedComponent<TValue = unknown, TContext = Record<string, unknown>>(placeholder: HTMLElement, options: EmbedOptions<TValue, TContext>): ComponentHandle<TValue> {
  const window = placeholder.ownerDocument.defaultView;
  if (!window) throw new Error('Component placeholder must be attached to a window');
  const channel = randomChannel();
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
  // The component has rendered once: a later frame error leaves it usable, and in the Tab order
  let rendered = false;
  const { promise: ready, resolve: markReady, reject: failReady } = deferred();
  // Settles on the frame's own `ready` message, so a frame that starts after the start timeout still serves `emit`
  const { promise: live, resolve: markLive, reject: failLive } = deferred();
  // Rejects at the start timeout, so `emit` fails instead of waiting for a frame that never starts
  const { promise: startFailed, reject: failStart } = deferred();
  const stop = (error: Error) => {
    failReady(error);
    failLive(error);
  };
  const fail = (error: unknown) => {
    const reported = toError(error);
    notify('error', reported);
    return reported;
  };
  const rejectPending = (error: Error) => {
    for (const call of pending.values()) call.reject(error);
    pending.clear();
  };
  const placed = placeFrame(placeholder, url.href, options.title ?? 'App component', rect => send({ type: 'rect', rect }));
  // A Tab stop only while the frame runs: from its first hello until it fails to start, or reports an error
  // before it rendered, so Tab skips a frame that shows an error page
  placed.iframe.tabIndex = -1;
  const skipInTabOrder = () => {
    placed.iframe.tabIndex = -1;
  };
  const focusFrame = () => {
    placed.iframe.focus();
    send({ type: 'focus' });
  };

  // Throws when the message cannot be cloned
  function post(message: HostMessage) {
    if (started && !destroyed) placed.iframe.contentWindow?.postMessage(wrap(channel, message), frameOrigin);
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
  // On a microtask, so listeners added right after mount see a getToken that throws at once
  const tokenLoaded = Promise.resolve().then(loadToken);

  // A frame page that never says hello (404, CSP, frame-ancestors) fails ready instead of leaving it pending
  placed.iframe.addEventListener('load', () => {
    if (greeted || destroyed) return;
    clearTimeout(startTimer);
    startTimer = setTimeout(() => {
      if (greeted || destroyed) return;
      const error = new Error('Component frame did not start');
      skipInTabOrder();
      failReady(error);
      failStart(error);
      fail(error);
    }, START_MS);
  });

  async function onMessage(event: MessageEvent) {
    if (event.origin !== frameOrigin || event.source !== placed.iframe.contentWindow) return;
    const message = unwrap<FrameMessage>(event.data, channel);
    if (!message) return;
    switch (message.type) {
      case 'hello':
        clearTimeout(startTimer);
        if (greeted) {
          // The frame reloaded: its new runtime starts without overlay and cannot answer earlier events
          placed.setOverlay(false);
          rejectPending(new Error('Component reloaded'));
        }
        if (!greeted) placed.iframe.removeAttribute('tabindex');
        greeted = true;
        await tokenLoaded;
        started = true;
        try {
          post({ type: 'init', props, token });
        } catch (error) {
          const reported = toError(error);
          skipInTabOrder();
          stop(reported);
          fail(reported);
        }
        return;
      case 'ready':
        rendered = true;
        markReady();
        markLive();
        return;
      case 'change':
        notify('change', message.value);
        return;
      case 'validity':
        notify('validity', typeof message.error === 'string' ? message.error : null);
        return;
      case 'resize':
        if (Number.isFinite(message.height)) placed.setHeight(Math.max(0, Math.ceil(message.height)));
        return;
      case 'overlay': {
        const on = message.on === true;
        send({ type: 'rect', rect: placed.setOverlay(on) });
        // The component's modal takes focus, unless focus is already in its frame
        if (on && placeholder.ownerDocument.activeElement !== placed.iframe) focusFrame();
        return;
      }
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
        if (!rendered) skipInTabOrder();
        stop(error);
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
      await Promise.race([live, startFailed]);
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
    focus() {
      if (!destroyed) focusFrame();
    },
    unmount() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(tokenTimer);
      clearTimeout(startTimer);
      rejectPending(new Error('Component unmounted'));
      stop(new Error('Component unmounted'));
      placed.destroy();
    },
  };
}
