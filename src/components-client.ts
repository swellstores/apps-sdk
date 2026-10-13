import type { ComponentInput, ComponentTarget, ComponentToken } from './components-types.js';
import { createListeners, deferred, embedComponent, pickInput, toError } from './components-host.js';
import type { ComponentHandle } from './components-host.js';
import { paymentActions } from './components-payment.js';

export interface ComponentsOptions {
  storeId: string;
  publicKey: string;
  /** Storefront API origin. Defaults to https://<storeId>.swell.store */
  url?: string;
  /**
   * Token source for an app's components. Hosts with their own session, like the Swell admin, pass it.
   * Without it the frame gets no token, and `props.fetch` sends no token header.
   */
  getToken?: (app: string) => Promise<ComponentToken>;
  /** Vault origin for payment intents. Defaults to https://vault.schema.io */
  vaultUrl?: string;
}

type HostActions = Record<string, (data: unknown) => unknown>;

export interface NamedMountOptions<TValue = unknown, TContext = Record<string, unknown>> extends ComponentInput<TValue, TContext> {
  /** App id or slug. */
  app: string;
  /** Component name: the file name in the app's components/ folder. */
  component: string;
  /** Accessible title of the frame. Defaults to the component name. */
  title?: string;
  /** Host actions the component can call. Built-in actions of payment components win over the same names. */
  actions?: HostActions;
}

export interface TargetMountOptions<TContext = Record<string, unknown>> extends ComponentInput<never, TContext> {
  /** The host place whose components the platform returns. */
  target: ComponentTarget;
  /** Narrows the place, e.g. `{ method: 'card' }`. */
  filters?: Record<string, string>;
  /** Accessible title of the frames. Defaults to each component's name. */
  title?: string;
  /** Host actions the components can call. Built-in actions of payment components win over the same names. */
  actions?: HostActions;
}

/** Options of mounting one component by name. Mounting by place takes `TargetMountOptions`. */
export type MountOptions<TValue = unknown, TContext = Record<string, unknown>> = NamedMountOptions<TValue, TContext>;

export interface TargetHandle {
  readonly ready: Promise<void>;
  /** What the place rendered, known once `ready` settles; empty when nothing matched. */
  readonly components: readonly { app: string; name: string }[];
  on(event: 'validity', handler: (error: string | null) => void): () => void;
  on(event: 'error', handler: (error: Error) => void): () => void;
  update(input: ComponentInput<never>): void;
  /** Sends an event to every component of the place; resolves with their results in order. */
  emit<T = unknown>(event: string, data?: unknown): Promise<T[]>;
  focus(): void;
  unmount(): void;
}

export interface Components {
  /**
   * Renders a component in `target` and returns its handle right away. The app's component list
   * loads in the background: `update` calls made meanwhile are kept, `unmount` cancels, and a failure
   * fires `error` and rejects `handle.ready`. Throws when `target` does not exist.
   * With `target` and `filters` in the options it renders every component the platform returns for that place.
   */
  mount<TValue = unknown, TContext = Record<string, unknown>>(target: string | HTMLElement, options: NamedMountOptions<TValue, TContext>): ComponentHandle<TValue>;
  mount<TContext = Record<string, unknown>>(target: string | HTMLElement, options: TargetMountOptions<TContext>): TargetHandle;
}

interface ComponentMeta {
  name: string;
  src: string;
  app?: string;
  settings?: Record<string, unknown>;
  extension?: { id: string; type: string };
  gateway?: string;
}

interface AppComponents {
  settings?: Record<string, unknown>;
  components?: ComponentMeta[];
}

const DEFAULT_VAULT_URL = 'https://vault.schema.io';

/** Renders installed apps' components. Create one instance per store. */
export function createComponents(options: ComponentsOptions): Components {
  if (!options?.storeId || !options.publicKey) throw new Error('createComponents requires storeId and publicKey');
  const base = (options.url ?? `https://${options.storeId}.swell.store`).replace(/\/+$/, '');
  const apps = new Map<string, Promise<AppComponents>>();

  const load = (app: string) => {
    let request = apps.get(app);
    if (!request) {
      request = fetch(`${base}/api/apps/${encodeURIComponent(app)}/components`, {
        headers: { Authorization: `Basic ${btoa(options.publicKey)}` },
      }).then(response => {
        if (!response.ok) throw new Error(`Cannot load components of app "${app}" (${response.status})`);
        return response.json() as Promise<AppComponents>;
      });
      apps.set(app, request);
      request.catch(() => apps.delete(app));
    }
    return request;
  };

  // Embeds one component: payment components also get the intent actions, read with the latest cart
  const embed = <TValue, TContext>(placeholder: HTMLElement, meta: ComponentMeta, app: string, input: ComponentInput<TValue, TContext>, title: string, actions?: Record<string, (data: unknown) => unknown>) => {
    const current = { context: input.context as unknown };
    const payment = meta.extension?.type === 'payment' && meta.gateway
      ? paymentActions({
        vaultUrl: options.vaultUrl ?? DEFAULT_VAULT_URL,
        publicKey: options.publicKey,
        gateway: meta.gateway,
        accountId: () => (current.context as { cart?: { account_id?: string } } | undefined)?.cart?.account_id,
      })
      : {};
    const handle = embedComponent<TValue, TContext>(placeholder, {
      ...input, src: meta.src, settings: meta.settings, title,
      actions: { ...actions, ...payment },
      getToken: options.getToken && (() => options.getToken!(app)),
    });
    return {
      ...handle,
      update(next: ComponentInput<TValue>) {
        if ('context' in next) current.context = next.context;
        handle.update(next);
      },
    };
  };

  const loadPlace = async (target: string, filters: Record<string, string> = {}) => {
    const query = new URLSearchParams({ ...filters, target });
    const response = await fetch(`${base}/api/apps/components?${query}`, {
      headers: { Authorization: `Basic ${btoa(options.publicKey)}` },
    });
    if (!response.ok) throw new Error(`Cannot load components of place "${target}" (${response.status})`);
    const { components = [] } = (await response.json()) as { components?: ComponentMeta[] };
    return components;
  };

  function mountNamed<TValue, TContext>(placeholder: HTMLElement, mountOptions: NamedMountOptions<TValue, TContext>): ComponentHandle<TValue> {
    const { app, component, title, actions, ...input } = mountOptions;
    const { on, notify } = createListeners();
    const { promise: ready, resolve: markReady, reject: failReady } = deferred();
    // Settles once the frame is embedded, so `emit` still works when the frame starts after `ready` failed
    const { promise: embedded, resolve: markEmbedded, reject: failEmbedded } = deferred();
    let inner: ComponentHandle<TValue> | null = null;
    let unmounted = false;

    load(app).then(({ settings, components = [] }) => {
      if (unmounted) return;
      const found = components.find(item => item.name === component);
      if (!found) throw new Error(`Component "${component}" not found in app "${app}"`);
      // `input` carries the updates made while the metadata loaded
      inner = embed<TValue, TContext>(placeholder, { ...found, settings: found.settings ?? settings }, app, input, title ?? component, actions);
      inner.on('change', value => notify('change', value));
      inner.on('validity', error => notify('validity', error));
      inner.on('error', error => notify('error', error));
      markEmbedded();
      inner.ready.then(markReady, failReady);
    }).catch((error) => {
      if (unmounted) return;
      const reported = toError(error);
      failReady(reported);
      failEmbedded(reported);
      notify('error', reported);
    });

    return {
      ready,
      on,
      update(next) {
        if (inner) inner.update(next);
        else Object.assign(input, pickInput(next));
      },
      async emit<T = unknown>(name: string, data?: unknown): Promise<T> {
        await embedded;
        return (inner as ComponentHandle<TValue>).emit<T>(name, data);
      },
      // Before the component list loads there is no frame to focus yet
      focus() {
        inner?.focus();
      },
      unmount() {
        if (unmounted) return;
        unmounted = true;
        inner?.unmount();
        failReady(new Error('Component unmounted'));
        failEmbedded(new Error('Component unmounted'));
      },
    };
  }

  function mountTarget<TContext>(placeholder: HTMLElement, mountOptions: TargetMountOptions<TContext>): TargetHandle {
    const { target, filters, title, actions, ...input } = mountOptions;
    const { on, notify } = createListeners();
    const { promise: ready, resolve: markReady, reject: failReady } = deferred();
    let handles: ComponentHandle<never>[] = [];
    let slots: HTMLElement[] = [];
    let rendered: { app: string; name: string }[] = [];
    let unmounted = false;

    const loaded = loadPlace(target, filters).then((components) => {
      if (unmounted) return;
      try {
        for (const meta of components) {
          const slot = placeholder.ownerDocument.createElement('div');
          placeholder.appendChild(slot);
          slots.push(slot);
          const handle = embed<never, TContext>(slot, meta, meta.app ?? '', input, title ?? meta.name, actions);
          handle.on('validity', error => notify('validity', error));
          handle.on('error', error => notify('error', error));
          handles.push(handle);
        }
      } catch (error) {
        // A component that cannot embed must not leave the earlier frames running
        handles.forEach(handle => handle.unmount());
        slots.forEach(slot => slot.remove());
        handles = [];
        slots = [];
        throw error;
      }
      rendered = components.map(meta => ({ app: meta.app ?? '', name: meta.name }));
      Promise.all(handles.map(handle => handle.ready)).then(() => markReady(), failReady);
    });
    loaded.catch((error) => {
      if (unmounted) return;
      const reported = toError(error);
      failReady(reported);
      notify('error', reported);
    });

    return {
      ready,
      get components() { return rendered; },
      on,
      update(next) {
        if (handles.length) handles.forEach(handle => handle.update(next));
        else Object.assign(input, pickInput(next));
      },
      async emit<T = unknown>(name: string, data?: unknown): Promise<T[]> {
        await loaded;
        if (unmounted) throw new Error('Component unmounted');
        return Promise.all(handles.map(handle => handle.emit<T>(name, data)));
      },
      focus() {
        handles[0]?.focus();
      },
      unmount() {
        if (unmounted) return;
        unmounted = true;
        handles.forEach(handle => handle.unmount());
        slots.forEach(slot => slot.remove());
        failReady(new Error('Component unmounted'));
      },
    } as TargetHandle;
  }

  function mount<TValue, TContext>(target: string | HTMLElement, mountOptions: NamedMountOptions<TValue, TContext>): ComponentHandle<TValue>;
  function mount<TContext>(target: string | HTMLElement, mountOptions: TargetMountOptions<TContext>): TargetHandle;
  function mount(target: string | HTMLElement, mountOptions: NamedMountOptions<unknown, any> | TargetMountOptions<any>): ComponentHandle<unknown> | TargetHandle {
    const placeholder = typeof target === 'string' ? globalThis.document?.querySelector<HTMLElement>(target) : target;
    if (!placeholder) throw new Error(`Component container "${String(target)}" not found`);
    return 'target' in mountOptions ? mountTarget(placeholder, mountOptions) : mountNamed(placeholder, mountOptions);
  }

  return { mount };
}
