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
  setValidity(error: string | null): void;
  /** fetch that adds the component token to requests to the frame's own origin. */
  readonly fetch: typeof fetch;
  /** Handles a host event; the first handler's result is returned to the host. */
  on(event: string, handler: (data: unknown) => unknown): () => void;
}

/** Optional static metadata a component file exports as `config`. */
export interface ComponentConfig {
  readonly description?: string;
}

/** Module the CLI builds for each component. */
export interface ComponentModule {
  mount(root: HTMLElement, props: ComponentProps): void;
  update(root: HTMLElement, props: ComponentProps): void;
  unmount(root: HTMLElement): void;
}

/** Data a host passes to a component. Values must be structured-cloneable. */
export interface ComponentInput<TValue = unknown, TContext = Record<string, unknown>> {
  value?: TValue;
  context?: TContext;
  params?: Record<string, unknown>;
  readonly?: boolean;
  locale?: string;
}

/** Short-lived platform token. `expires` is in epoch seconds. */
export interface ComponentToken {
  readonly token: string;
  readonly expires: number;
}
