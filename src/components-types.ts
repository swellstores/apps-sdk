/** Props every app component receives. Places differ only in what they put into them. */
export interface ComponentProps<TValue = unknown, TContext = Record<string, unknown>> {
  /** Bound value, when the place provides one. */
  readonly value: TValue;
  setValue(value: TValue): void;
  /** Data of the place, provided by the host. */
  readonly context: TContext;
  /** Configuration from the usage site. */
  readonly params: Readonly<Record<string, unknown>>;
  /** The app's public settings. */
  readonly settings: Readonly<Record<string, unknown>>;
  readonly locale: string;
  readonly readonly: boolean;
  /**
   * The host's color theme. The frame also sets it as `data-theme` and `color-scheme` on its root element, so CSS
   * can follow it with `:root[data-theme="dark"]`. `'light'` when the host passes none.
   */
  readonly theme: ComponentTheme;
  setValidity(error: string | null): void;
  /** fetch that adds the component token to requests to the frame's own origin. */
  readonly fetch: typeof fetch;
  /**
   * Handles a host event. Every handler registered for the event runs, in the order registered, each after the
   * previous one settles. The first error thrown answers the host's `emit` and the later handlers do not run;
   * otherwise `emit` resolves with the last result other than `undefined`. A handler registered again, as an effect
   * does on a re-render, moves to the end, so keep steps that depend on each other in one handler. One removed while
   * the event runs is skipped, and one registered meanwhile runs from the next event.
   */
  on(event: string, handler: (data: unknown) => unknown): () => void;
  /**
   * Calls an action the host offers, such as `createIntent` for payment components, and resolves
   * with its result. Rejects with the host's error, or with `Unknown host action "<name>"`.
   */
  call<T = unknown>(name: string, data?: unknown): Promise<T>;
}

export type ComponentTheme = 'light' | 'dark';

/** Optional static metadata a component file exports as `config`. */
export interface ComponentConfig {
  readonly description?: string;
  /** Makes the component the UI of an extension of the app's swell.json. A string is the legacy swell.app contract. */
  readonly extension?: { readonly id: string };
  /** Host places the component opts into. */
  readonly targets?: readonly { readonly id: ComponentTarget }[];
}

/** Module the CLI builds for each component. */
export interface ComponentModule {
  /** The frame reports the component ready once a returned promise resolves. */
  mount(root: HTMLElement, props: ComponentProps): void | Promise<void>;
  update(root: HTMLElement, props: ComponentProps): void | Promise<void>;
  unmount(root: HTMLElement): void;
}

/** Data a host passes to a component. Values must be structured-cloneable. */
export interface ComponentInput<TValue = unknown, TContext = Record<string, unknown>> {
  value?: TValue;
  context?: TContext;
  params?: Record<string, unknown>;
  readonly?: boolean;
  locale?: string;
  /** The host's color theme, light by default. Update it when the host switches. */
  theme?: ComponentTheme;
}

/** Short-lived platform token. `expires` is in epoch seconds. */
export interface ComponentToken {
  readonly token: string;
  readonly expires: number;
}

/** A host place id. The SDK knows no list: the platform defines places and validates ids on push. */
export type ComponentTarget = string;

export interface PaymentMethodInfo {
  readonly id: string;
  readonly name?: string;
  readonly mode?: string;
}

export interface PaymentContext<TCart extends object = Record<string, unknown>> {
  readonly cart: TCart & { readonly account_id?: string; readonly currency?: string; readonly capture_total?: number };
  readonly method?: PaymentMethodInfo;
}

export interface PaymentSubmitData {
  readonly billing: Record<string, unknown>;
}

export interface PaymentRedirectData {
  readonly params: Record<string, string>;
}

/** What a payment component's `submit` and `redirect` handlers return: merged into the cart's billing. */
export interface PaymentSubmitResult {
  readonly billing: Record<string, unknown>;
}
