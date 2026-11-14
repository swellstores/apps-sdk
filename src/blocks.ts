// Storefront app blocks, for hosts (the app block standard v1): reading the store's installed apps' declarations
// (swell.json storefront.embeds) as strictly as the standard asks, the rules a host applies when it places and renders
// a block, the page's CSP sources, and the block registry that mounts `script` blocks on a page.
//
// A declaration that breaks one rule is left out whole (every block of that app): a host shows no partial result. The
// reading has no DOM and runs on a server or in a Worker; startBlockRegistry runs in the page.

export type BlockPage = 'home' | 'product' | 'category' | 'category_list' | 'search' | 'cart' | 'content' | 'blog' | 'blog_post' | 'account' | 'not_found';
/** The page types a block's `pages` may list. */
export const BLOCK_PAGES: readonly BlockPage[] = Object.freeze(['home', 'product', 'category', 'category_list', 'search', 'cart', 'content', 'blog', 'blog_post', 'account', 'not_found']);

export type BlockPropType = 'text' | 'textarea' | 'url' | 'number' | 'boolean' | 'select';
/** A prop of a block: a field the host's editor renders, whose value reaches the block. */
export interface BlockProp {
  id: string;
  type: BlockPropType;
  label: string;
  description?: string;
  default?: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

/** A block an app declares. `component` is set for a block whose render is "component". */
export interface Block {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  pages?: BlockPage[];
  props?: BlockProp[];
  component?: string;
}

/** One app's blocks, as a host uses them. */
export interface AppBlocks {
  /** The installation's app slug. */
  app: string;
  name: string;
  /** The exact https URL of the app's script; absent for an app of `component` blocks only. */
  script?: string;
  integrity?: string;
  /** Third-party https origins its script calls (connect-src). */
  connect: string[];
  /** Third-party https origins, or "data:", its script loads images from (img-src). */
  img: string[];
  blocks: Block[];
  /** An app with `component` blocks: its installation's frontend origin, where their frames load (frame-src). */
  frame?: string;
  /** ...and its app record id. */
  appId?: string;
  /** Its app record's icon, on Swell's CDN. */
  icon?: string;
}

export type ReadResult = { ok: true; app: AppBlocks } | { ok: false; problem: string };

export const BLOCK_LIMITS = Object.freeze({
  /** Apps a host reads from one store. */
  apps: 10,
  /** Blocks per app (more are left out). */
  blocks: 20,
  /** Props per block. */
  props: 20,
  /** Options per select prop. */
  options: 50,
  /** connect and img origins, each. */
  sources: 10,
  /** Characters of a label or a name. */
  label: 80,
  /** Characters of a description. */
  description: 300,
  /** Characters of a text prop's default. */
  textDefault: 500,
  /** Characters of the script URL. */
  url: 500,
});

const APP_ID_RE = /^[a-z0-9_-]{1,40}$/;
const BLOCK_ID_RE = /^[a-z0-9_]{1,40}$/;
// No characters a CSP source list or an HTML attribute would read otherwise (space, ';', ',', quotes).
const SCRIPT_RE = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?\/[A-Za-z0-9._~/%-]*(?:\?[A-Za-z0-9._~=&%-]*)?$/;
const ORIGIN_RE = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/;
const INTEGRITY_RE = /^(?:sha256-[A-Za-z0-9+/]{43}=|sha384-[A-Za-z0-9+/]{64}|sha512-[A-Za-z0-9+/]{86}==)$/;
const ENTRY_KEYS = new Set(['version', 'app', 'name', 'script', 'integrity', 'connect', 'img', 'blocks']);
const DECLARED_KEYS = new Set(['version', 'script', 'integrity', 'connect', 'img', 'blocks']);
const BLOCK_KEYS = new Set(['id', 'label', 'description', 'icon', 'render', 'component', 'pages', 'props']);
const COMPONENT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PROP_KEYS = new Set(['id', 'type', 'label', 'description', 'default', 'options', 'min', 'max']);
const PROP_TYPES = new Set(['text', 'textarea', 'url', 'number', 'boolean', 'select']);
const PROP_ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const ICON_RE = /^[a-z0-9-]{1,40}$/;
const FRONTEND_LINK = 'frontend://';
const RECORD_ID_RE = /^[a-f0-9]{24}$/;
const STORE_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const ICON_URL_RE = /^https:\/\/cdn\.(?:swell\.store|schema\.io)\/[A-Za-z0-9._~/%-]{1,400}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
// Text a host shows as is: control characters dropped and spaces collapsed, 1 to max characters.
const text = (v: unknown, max: number = BLOCK_LIMITS.label): string | null => {
  if (typeof v !== 'string') return null;
  // whitespace (newlines, tabs) becomes one space; other control characters go
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  return s && s.length <= max ? s : null;
};

// The https URL as it would be loaded, when it is exactly its normalized form and safe in a CSP source list.
function scriptUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > BLOCK_LIMITS.url || !SCRIPT_RE.test(v)) return null;
  try {
    return new URL(v).href === v ? v : null;
  } catch {
    return null;
  }
}

function origins(v: unknown, data: boolean): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > BLOCK_LIMITS.sources) return null;
  return v.every((x) => typeof x === 'string' && (ORIGIN_RE.test(x) || (data && x === 'data:'))) ? [...new Set(v as string[])] : null;
}

function propOf(v: unknown): BlockProp | string {
  if (!isObj(v) || Object.keys(v).some((k) => !PROP_KEYS.has(k))) return 'must be {id, type, label, description?, default?, options?, min?, max?}';
  const { id, type, min, max, default: d } = v;
  if (typeof id !== 'string' || !PROP_ID_RE.test(id)) return 'id must match [A-Za-z][A-Za-z0-9_]{0,39}';
  if (typeof type !== 'string' || !PROP_TYPES.has(type)) return `(${id}).type must be text, textarea, url, number, boolean or select`;
  const label = text(v.label);
  if (label === null) return `(${id}).label must be text of 1 to ${BLOCK_LIMITS.label} characters`;
  const description = v.description === undefined ? undefined : text(v.description, BLOCK_LIMITS.description);
  if (description === null) return `(${id}).description must be text of 1 to ${BLOCK_LIMITS.description} characters`;
  const num = (x: unknown) => x === undefined || (typeof x === 'number' && Number.isFinite(x));
  if ((min !== undefined || max !== undefined) && (type !== 'number' || !num(min) || !num(max) || (min as number) > (max as number))) {
    return `(${id}).min and max are numbers (min at most max) of a number prop`;
  }
  let options: { value: string; label: string }[] | undefined;
  if (type === 'select') {
    const list = Array.isArray(v.options) && v.options.length <= BLOCK_LIMITS.options ? v.options : [];
    options = [];
    for (const o of list) {
      const optionLabel = isObj(o) ? text(o.label) : null;
      if (!isObj(o) || typeof o.value !== 'string' || !o.value || o.value.length > BLOCK_LIMITS.label || optionLabel === null || Object.keys(o).some((k) => k !== 'value' && k !== 'label')) break;
      if (options.some((x) => x.value === o.value)) break;
      options.push({ value: o.value, label: optionLabel });
    }
    if (!options.length || options.length !== list.length) return `(${id}).options must be 1 to ${BLOCK_LIMITS.options} {value, label}, each value once`;
  } else if (v.options !== undefined) return `(${id}).options are a select prop's`;
  const ok = d === undefined || (
    type === 'boolean' ? typeof d === 'boolean'
      : type === 'number' ? typeof d === 'number' && Number.isFinite(d) && !(typeof min === 'number' && d < min) && !(typeof max === 'number' && d > max)
        : type === 'select' ? options!.some((o) => o.value === d)
          : typeof d === 'string' && d.length <= BLOCK_LIMITS.textDefault);
  if (!ok) return `(${id}).default must be a value of its type`;
  return {
    id, type: type as BlockPropType, label, ...(description ? { description } : {}), ...(d !== undefined ? { default: d as string | number | boolean } : {}),
    ...(options ? { options } : {}), ...(min !== undefined ? { min: min as number } : {}), ...(max !== undefined ? { max: max as number } : {}),
  };
}

function blockOf(b: unknown): Block | string {
  const label = isObj(b) ? text(b.label) : null;
  if (!isObj(b) || typeof b.id !== 'string' || !BLOCK_ID_RE.test(b.id) || label === null || Object.keys(b).some((k) => !BLOCK_KEYS.has(k))) {
    return 'must be {id: [a-z0-9_]{1,40}, label, description?, icon?, render?, component?, pages?, props?}';
  }
  const description = b.description === undefined ? undefined : text(b.description, BLOCK_LIMITS.description);
  if (description === null) return `(${b.id}).description must be text of 1 to ${BLOCK_LIMITS.description} characters`;
  if (b.icon !== undefined && (typeof b.icon !== 'string' || !ICON_RE.test(b.icon))) return `(${b.id}).icon must match [a-z0-9-]{1,40}`;
  if (b.render !== undefined && b.render !== 'script' && b.render !== 'component') return `(${b.id}).render must be "script" or "component"`;
  const component = b.render === 'component';
  if (component ? typeof b.component !== 'string' || !COMPONENT_RE.test(b.component) : b.component !== undefined) {
    return `(${b.id}).component names a component (${COMPONENT_RE.source}) of a block whose render is "component", and only of one`;
  }
  const pages = b.pages;
  if (pages !== undefined && (!Array.isArray(pages) || !pages.length || pages.some((x, i) => !BLOCK_PAGES.includes(x as BlockPage) || pages.indexOf(x) !== i))) {
    return `(${b.id}).pages must be a non-empty list of ${BLOCK_PAGES.join(', ')}, each once`;
  }
  if (b.props !== undefined && (!Array.isArray(b.props) || b.props.length > BLOCK_LIMITS.props)) return `(${b.id}).props must be a list of at most ${BLOCK_LIMITS.props}`;
  const props: BlockProp[] = [];
  for (const [i, p] of ((b.props as unknown[] | undefined) ?? []).entries()) {
    const prop = propOf(p);
    if (typeof prop === 'string') return `(${b.id}).props[${i}] ${prop}`;
    if (props.some((x) => x.id === prop.id)) return `(${b.id}).props[${i}].id ${prop.id} is listed twice`;
    props.push(prop);
  }
  return {
    id: b.id, label, ...(description ? { description } : {}), ...(b.icon ? { icon: b.icon as string } : {}),
    ...(pages !== undefined ? { pages: pages as BlockPage[] } : {}), ...(b.props !== undefined ? { props } : {}), ...(component ? { component: b.component as string } : {}),
  };
}

export interface ReadOptions {
  /**
   * The installation origin and app record id of an installed app: its `component` blocks need them (their frames load
   * there). Without them, `component` blocks are left out (onProblem says so) and only `script` blocks stay.
   */
  frame?: { origin: string; appId: string };
  /** Where the problem is, for messages (default: the app's id). */
  at?: string;
  /** Problems that leave part of the declaration out but keep the rest. */
  onProblem?: (message: string) => void;
  /** Apps already read for this page or store: a second declaration of the same app is refused. */
  seen?: ReadonlySet<string>;
}

/**
 * One app's blocks from an entry of the form `{version?, app, name, script?, integrity?, connect?, img?, blocks}`,
 * `script` being the exact https URL to load. A broken rule refuses the whole entry, naming it.
 */
export function readAppBlocks(v: unknown, options: ReadOptions = {}): ReadResult {
  const at = options.at ?? 'the app\'s storefront.embeds';
  const fail = (problem: string): ReadResult => ({ ok: false, problem });
  if (!isObj(v)) return fail(`${at} is not an object`);
  const extra = Object.keys(v).find((k) => !ENTRY_KEYS.has(k));
  if (extra !== undefined) return fail(`${at} has an unknown key ${JSON.stringify(extra.slice(0, 40))}`);
  const { app, integrity } = v;
  if (v.version !== undefined && v.version !== 1) return fail(`${at}.version ${JSON.stringify(v.version).slice(0, 20)} is not one this storefront reads (1)`);
  if (typeof app !== 'string' || !APP_ID_RE.test(app)) return fail(`${at}.app must match [a-z0-9_-]{1,40}`);
  if (options.seen?.has(app)) return fail(`${at}.app ${app} is listed twice`);
  const name = text(v.name);
  if (name === null) return fail(`${at} (${app}).name must be text of 1 to ${BLOCK_LIMITS.label} characters`);
  const script = v.script === undefined ? undefined : scriptUrl(v.script);
  if (script === null) return fail(`${at} (${app}).script must be an https URL in normal form`);
  if (integrity !== undefined && (typeof integrity !== 'string' || !INTEGRITY_RE.test(integrity))) return fail(`${at} (${app}).integrity must be sha256-, sha384- or sha512-<base64>`);
  const connect = origins(v.connect, false);
  if (connect === null) return fail(`${at} (${app}).connect must be a list of at most ${BLOCK_LIMITS.sources} https origins`);
  const img = origins(v.img, true);
  if (img === null) return fail(`${at} (${app}).img must be a list of at most ${BLOCK_LIMITS.sources} https origins or "data:"`);
  if (!Array.isArray(v.blocks) || !v.blocks.length) return fail(`${at} (${app}).blocks must be a non-empty list`);
  if (v.blocks.length > BLOCK_LIMITS.blocks) options.onProblem?.(`${at} (${app}) has ${v.blocks.length} blocks; only the first ${BLOCK_LIMITS.blocks} are used`);
  const blocks: Block[] = [];
  const dropped: string[] = [];
  for (const [i, b] of v.blocks.slice(0, BLOCK_LIMITS.blocks).entries()) {
    const block = blockOf(b);
    if (typeof block === 'string') return fail(`${at} (${app}).blocks[${i}] ${block}`);
    if (blocks.some((x) => x.id === block.id) || dropped.includes(block.id)) return fail(`${at} (${app}).blocks[${i}].id ${block.id} is listed twice`);
    if (isComponentBlock(block) && !options.frame) dropped.push(block.id);
    else blocks.push(block);
  }
  if (dropped.length) options.onProblem?.(`${at} (${app}) blocks ${dropped.join(', ')} render as components, which only an installed app's declaration can offer; left out`);
  if (!blocks.length) return fail(`${at} (${app}) has no blocks this storefront shows`);
  if (hasScriptBlocks({ blocks }) && script === undefined) return fail(`${at} (${app}).script is required for its script blocks`);
  const framed = options.frame && blocks.some(isComponentBlock) ? { frame: options.frame.origin, appId: options.frame.appId } : {};
  return { ok: true, app: { app, name, ...(script !== undefined ? { script } : {}), ...(integrity ? { integrity: integrity as string } : {}), connect, img, blocks, ...framed } };
}

/**
 * The origin of an installation's frontend, where its block script and component frames load: Swell serves it at
 * `<store>--<installation>--app` on the store's own domain, the host of `adminUrl` (a storefront request's verified
 * context) less its first label. A loopback `adminUrl` (local mocks) gives `swell.test`. null: any other host, or ids
 * of another form.
 */
export function appFrontendOrigin(adminUrl: string, storeId: string, installationId: string): string | null {
  if (!STORE_ID_RE.test(storeId) || !RECORD_ID_RE.test(installationId)) return null;
  let u: URL;
  try {
    u = new URL(adminUrl);
  } catch {
    return null;
  }
  const host = LOOPBACK.has(u.hostname) ? `${storeId}.swell.test` : u.host.toLowerCase();
  return host.startsWith(`${storeId}.`) ? `https://${storeId}--${installationId}--app${host.slice(storeId.length)}` : null;
}

export interface InstalledOptions {
  /** An installation's frontend origin (appFrontendOrigin), or null to leave its app out. */
  origin: (installationId: string) => string | null;
  /** Each problem, as one line (a host logs it once). */
  onProblem?: (message: string) => void;
}

/**
 * The blocks of the store's installed apps, from `GET /:clients/:self/apps` with `app` expanded: one entry per
 * installation that is neither uninstalled nor inactive and whose app declares blocks, named by the app's slug (its
 * private id without the leading underscore), its `frontend://` script on that installation's frontend. At most
 * BLOCK_LIMITS.apps; an app whose declaration breaks a rule is left out (onProblem).
 */
export function readInstalledBlocks(raw: unknown, options: InstalledOptions): AppBlocks[] {
  const out: AppBlocks[] = [];
  const seen = new Set<string>();
  for (const r of isObj(raw) && Array.isArray(raw.results) ? raw.results : []) {
    if (!isObj(r) || r.uninstalled === true || r.active === false || !isObj(r.app)) continue;
    const declared = isObj(r.app.storefront) ? r.app.storefront.embeds : undefined;
    if (declared === undefined || declared === null) continue;
    const slug = typeof r.app_private_id === 'string' ? r.app_private_id.replace(/^_/, '') : '';
    const at = `the installed app ${JSON.stringify(slug.slice(0, 40))}'s storefront.embeds`;
    if (out.length === BLOCK_LIMITS.apps) {
      options.onProblem?.(`more than ${BLOCK_LIMITS.apps} installed apps declare app embeds; only the first ${BLOCK_LIMITS.apps} are used`);
      break;
    }
    if (!isObj(declared) || Object.keys(declared).some((k) => !DECLARED_KEYS.has(k))) {
      options.onProblem?.(`${at} must be {version?, script?, integrity?, connect?, img?, blocks}; left out`);
      continue;
    }
    const base = typeof r.id === 'string' ? options.origin(r.id) : null;
    const path = typeof declared.script === 'string' && declared.script.startsWith(FRONTEND_LINK) ? declared.script.slice(FRONTEND_LINK.length).replace(/^\/+/, '') : null;
    const appId = typeof r.app_id === 'string' && RECORD_ID_RE.test(r.app_id) ? r.app_id : null;
    if (base === null || (declared.script !== undefined && path === null)) {
      options.onProblem?.(`${at}.script must be a ${FRONTEND_LINK} link on the app's frontend; left out`);
      continue;
    }
    const result = readAppBlocks(
      { ...declared, app: slug, name: r.app.name, ...(path !== null ? { script: `${base}/${path}` } : {}) },
      { at, seen, onProblem: options.onProblem, ...(appId ? { frame: { origin: base, appId } } : {}) },
    );
    if (!result.ok) {
      options.onProblem?.(`${result.problem}; left out`);
      continue;
    }
    seen.add(result.app.app);
    const iconUrl = isObj(r.app.logo_icon) && typeof r.app.logo_icon.url === 'string' && ICON_URL_RE.test(r.app.logo_icon.url) ? r.app.logo_icon.url : null;
    out.push(iconUrl ? { ...result.app, icon: iconUrl } : result.app);
  }
  return out;
}

/** Whether a block may be placed on (and rendered on) a page of that type: its `pages`, else every type but account. */
export const blockAllowedOn = (block: Pick<Block, 'pages'>, page: BlockPage): boolean => (block.pages ? block.pages.includes(page) : page !== 'account');
/** Whether a block renders as a component in a frame (render "component"). */
export const isComponentBlock = (block: Pick<Block, 'component'>): boolean => typeof block.component === 'string';
/** Whether an app has `script` blocks (its script loads on a page that holds one). */
export const hasScriptBlocks = (app: Pick<AppBlocks, 'blocks'>): boolean => app.blocks.some((b) => !isComponentBlock(b));

/**
 * The CSP sources a page adds for its blocks. scripts: the apps whose `script` blocks it holds (or may show, in a cart
 * drawer); frames: those whose `component` blocks it holds. A script URL is a source without its query (CSP sources
 * have none).
 */
export function blockCspSources(scripts: readonly AppBlocks[], frames: readonly AppBlocks[] = []): { scriptSrc: string[]; connectSrc: string[]; imgSrc: string[]; frameSrc: string[] } {
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    scriptSrc: uniq(scripts.flatMap((e) => {
      if (!e.script) return [];
      const u = new URL(e.script);
      return [u.origin + u.pathname];
    })),
    connectSrc: uniq(scripts.flatMap((e) => e.connect)),
    imgSrc: uniq(scripts.flatMap((e) => e.img)),
    frameSrc: uniq(frames.flatMap((e) => (e.frame ? [e.frame] : []))),
  };
}

// ---- The block registry (in the page) ----

/** What every `script` block's mount gets about the page. */
export interface BlockStorefront {
  storeId: string;
  storefrontId: string;
  locale?: string;
  currency?: string;
  mode: 'live' | 'preview';
}

export interface BlockMountContext {
  props: Record<string, unknown>;
  app: string;
  block: string;
  storefront: BlockStorefront;
  /** The app proxy's base path on this page's origin. */
  proxy: string;
  /** The storefront's own public key, once the platform issues one. Never a key of the host's own installation. */
  publicKey?: string;
}

export interface BlockRegistration {
  app: string;
  blocks: Record<string, { mount(element: HTMLElement, context: BlockMountContext): void | (() => void) }>;
}

export interface BlockRegistryOptions {
  /** The apps whose scripts this page loads: a registration of any other app is ignored. */
  apps: readonly string[];
  storefront: BlockStorefront;
  publicKey?: string;
  /** The mount element's id attribute (default `data-app-block`; the props are always in `data-app-props`). */
  attribute?: string;
  /** The document (default: the global one). */
  document?: Document;
}

declare global {
  interface Window {
    SwellAppBlocks?: BlockRegistration[] | { push(...registrations: BlockRegistration[]): void };
  }
}

/**
 * Starts the page's block registry: `window.SwellAppBlocks` becomes an object whose `push` registers an app's blocks
 * (an array an app script pushed to before is registered too). Each registered block mounts on every matching element
 * now and added later, once per element; its cleanup runs when the element leaves the page, and when its props change
 * (the block then mounts again). Returns a function that stops the registry and cleans up every block.
 */
export function startBlockRegistry(options: BlockRegistryOptions): () => void {
  const doc = options.document ?? document;
  const win = doc.defaultView as (Window & typeof globalThis) | null;
  if (!win) throw new Error('startBlockRegistry needs a document with a window');
  const attribute = options.attribute ?? 'data-app-block';
  const selector = `[${attribute}][data-app-props]`;
  const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  const registered: Record<string, BlockRegistration['blocks']> = Object.create(null);
  // each mounted element: the props it mounted with and its cleanup
  const mounted = new Map<Element, { props: string; cleanup?: () => void }>();

  const cleanup = (el: Element) => {
    const m = mounted.get(el);
    mounted.delete(el);
    if (m?.cleanup) {
      try {
        m.cleanup();
      } catch (e) {
        console.error(e);
      }
    }
  };
  const mount = (el: Element) => {
    const raw = el.getAttribute('data-app-props') ?? '';
    const was = mounted.get(el);
    if (was && was.props === raw) return;
    if (was) cleanup(el);
    const id = el.getAttribute(attribute) ?? '';
    const slash = id.indexOf('/');
    const app = id.slice(0, slash);
    const block = id.slice(slash + 1);
    if (slash < 1 || !has(registered, app) || !has(registered[app], block)) return;
    const definition = registered[app][block];
    if (!definition || typeof definition.mount !== 'function') return;
    let props: unknown;
    try {
      props = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isObj(props)) return;
    const entry: { props: string; cleanup?: () => void } = { props: raw };
    mounted.set(el, entry);
    try {
      const off = definition.mount(el as HTMLElement, { props, app, block, storefront: options.storefront, proxy: `/.swell/apps/${app}`, ...(options.publicKey ? { publicKey: options.publicKey } : {}) });
      if (typeof off === 'function') entry.cleanup = off;
    } catch (e) {
      console.error(e);
    }
  };
  const scan = () => {
    doc.querySelectorAll(selector).forEach(mount);
    for (const el of [...mounted.keys()]) if (!el.isConnected || !el.matches(selector)) cleanup(el);
  };
  const add = (x: unknown) => {
    if (!isObj(x) || typeof x.app !== 'string' || !options.apps.includes(x.app) || has(registered, x.app) || !isObj(x.blocks)) return;
    registered[x.app] = x.blocks as BlockRegistration['blocks'];
    scan();
  };

  const queued = win.SwellAppBlocks;
  win.SwellAppBlocks = { push: (...registrations: BlockRegistration[]) => registrations.forEach(add) };
  if (Array.isArray(queued)) queued.forEach(add);
  const observer = new win.MutationObserver(scan);
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-app-props', attribute] });
  return () => {
    observer.disconnect();
    for (const el of [...mounted.keys()]) cleanup(el);
  };
}
