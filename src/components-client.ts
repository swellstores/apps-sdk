import type { ComponentInput, ComponentToken } from './components-types.js';
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

export interface MountOptions<TValue = unknown, TContext = Record<string, unknown>> extends ComponentInput<TValue, TContext> {
  /** App id or slug. */
  app: string;
  /** Component name: the file name in the app's components/ folder. */
  component: string;
  /** Accessible title of the frame. Defaults to the component name. */
  title?: string;
  /** Host actions the component can call. Built-in actions of payment components win over the same names. */
  actions?: Record<string, (data: unknown) => unknown>;
}

export interface Components {
  /**
   * Renders a component in `target` and returns its handle right away. The app's component list
   * loads in the background: `update` calls made meanwhile are kept, `unmount` cancels, and a failure
   * fires `error` and rejects `handle.ready`. Throws when `target` does not exist.
   */
  mount<TValue = unknown, TContext = Record<string, unknown>>(target: string | HTMLElement, options: MountOptions<TValue, TContext>): ComponentHandle<TValue>;
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

  return {
    mount<TValue = unknown, TContext = Record<string, unknown>>(target: string | HTMLElement, mountOptions: MountOptions<TValue, TContext>): ComponentHandle<TValue> {
      const placeholder = typeof target === 'string' ? globalThis.document?.querySelector<HTMLElement>(target) : target;
      if (!placeholder) throw new Error(`Component container "${String(target)}" not found`);
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
    },
  };
}
