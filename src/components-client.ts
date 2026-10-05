import type { ComponentInput, ComponentToken } from './components-types.js';
import { embedComponent } from './components-host.js';
import type { ComponentHandle } from './components-host.js';

export interface ComponentsOptions {
  storeId: string;
  publicKey: string;
  /** Storefront API origin. Defaults to https://<storeId>.swell.store */
  url?: string;
  /** Token source for an app's components. Hosts with their own session, like the Swell admin, pass it. */
  getToken?: (app: string) => Promise<ComponentToken>;
}

export interface MountOptions<TValue = unknown, TContext = Record<string, unknown>> extends ComponentInput<TValue, TContext> {
  /** App id or slug. */
  app: string;
  /** Component name: the file name in the app's components/ folder. */
  component: string;
  /** Accessible title of the frame. Defaults to the component name. */
  title?: string;
}

export interface Components {
  mount<TValue = unknown, TContext = Record<string, unknown>>(target: string | HTMLElement, options: MountOptions<TValue, TContext>): Promise<ComponentHandle<TValue>>;
}

interface AppComponents {
  settings?: Record<string, unknown>;
  components?: { name: string; src: string }[];
}

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

  return {
    async mount<TValue = unknown, TContext = Record<string, unknown>>(target: string | HTMLElement, mountOptions: MountOptions<TValue, TContext>): Promise<ComponentHandle<TValue>> {
      const placeholder = typeof target === 'string' ? globalThis.document?.querySelector<HTMLElement>(target) : target;
      if (!placeholder) throw new Error(`Component container "${String(target)}" not found`);
      const { app, component, title, ...input } = mountOptions;
      const { settings, components = [] } = await load(app);
      const found = components.find(item => item.name === component);
      if (!found) throw new Error(`Component "${component}" not found in app "${app}"`);
      const { getToken } = options;
      return embedComponent<TValue, TContext>(placeholder, { ...input, src: found.src, settings, title: title ?? component, getToken: getToken && (() => getToken(app)) });
    },
  };
}
