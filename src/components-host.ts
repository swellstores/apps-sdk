import type { ComponentInput, ComponentToken } from './components-types.js';
import { createFrameLayer } from './components-layer.js';
import { unwrap, wrap } from './components-protocol.js';
import type { FrameMessage, HostMessage, WireProps } from './components-protocol.js';

/** Controls one mounted component. */
export interface ComponentHandle<TValue = unknown> {
  /** Resolves when the component has mounted in its frame; rejects when it fails or is unmounted first. */
  readonly ready: Promise<void>;
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
const REFRESH_SECONDS = 60;
const MAX_TIMEOUT = 2 ** 31 - 1;

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
  const listeners: Record<'change' | 'validity' | 'error', Set<Listener>> = { change: new Set(), validity: new Set(), error: new Set() };
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let calls = 0;
  let token: string | null = null;
  let tokenTimer: ReturnType<typeof setTimeout> | undefined;
  let started = false;
  let destroyed = false;
  let markReady!: () => void;
  let failReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    failReady = reject;
  });
  ready.catch(() => {});

  const notify = (event: keyof typeof listeners, value: unknown) => {
    for (const handler of listeners[event]) (handler as (value: unknown) => void)(value);
  };
  const fail = (error: unknown) => notify('error', error instanceof Error ? error : new Error(String(error)));
  const layer = createFrameLayer(placeholder, url.href, options.title ?? 'App component', rect => send({ type: 'rect', rect }));

  function send(message: HostMessage) {
    if (!started || destroyed) return;
    try {
      layer.iframe.contentWindow?.postMessage(wrap(channel, message), frameOrigin);
    } catch (error) {
      fail(error);
    }
  }

  async function loadToken() {
    if (!options.getToken || destroyed) return;
    try {
      const next = await options.getToken();
      if (destroyed) return;
      token = next.token;
      const delay = Math.min(MAX_TIMEOUT, Math.max(0, (next.expires - REFRESH_SECONDS) * 1000 - Date.now()));
      tokenTimer = setTimeout(() => {
        void loadToken().then(() => send({ type: 'token', token }));
      }, delay);
    } catch (error) {
      token = null;
      fail(error);
    }
  }
  const tokenLoaded = loadToken();

  async function onMessage(event: MessageEvent) {
    if (event.origin !== frameOrigin || event.source !== layer.iframe.contentWindow) return;
    const message = unwrap<FrameMessage>(event.data, channel);
    if (!message) return;
    switch (message.type) {
      case 'hello':
        started = true;
        await tokenLoaded;
        send({ type: 'init', props, token });
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
        send({ type: 'rect', rect: layer.setOverlay(message.on === true) });
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
    on(event: keyof typeof listeners, handler: Listener) {
      listeners[event].add(handler);
      return () => {
        listeners[event].delete(handler);
      };
    },
    update(input) {
      const changed: Partial<WireProps> = {};
      for (const key of ['value', 'context', 'params', 'readonly', 'locale'] as const) {
        if (key in input) Object.assign(changed, { [key]: input[key] });
      }
      Object.assign(props, changed);
      send({ type: 'update', props: changed });
    },
    async emit<T = unknown>(name: string, data?: unknown): Promise<T> {
      await ready;
      if (destroyed) throw new Error('Component unmounted');
      return new Promise<T>((resolve, reject) => {
        const call = ++calls;
        pending.set(call, { resolve: resolve as (value: unknown) => void, reject });
        send({ type: 'event', call, name, data });
      });
    },
    unmount() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(tokenTimer);
      for (const call of pending.values()) call.reject(new Error('Component unmounted'));
      pending.clear();
      failReady(new Error('Component unmounted'));
      layer.destroy();
    },
  };
}
