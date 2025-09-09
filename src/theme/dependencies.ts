// Collects per-route collection dependencies from theme configs
// Inspects page templates and section schemas without fetching page data

import JSON5 from 'json5';

import type { SwellTheme } from '../theme';
import type {
  ThemePageTemplateConfig,
  ThemeSectionConfig,
  ThemeSectionGroup,
} from 'types/swell';
import type { SwellAppStorefrontThemePage } from 'types/swell';
import {
  StorefrontResource,
  getStorefrontResourceCollection,
} from '../resources';

/**
 * Returns a sorted list of collections that a given page depends on.
 * - Includes resolved section lookups (actual dependencies)
 * - Seeds from page.collection or inferred from page.record (resource-driven)
 * - Optionally includes layout/global section dependencies and Shopify potential hints
 */
export async function getPageDependencies(
  theme: SwellTheme,
  pageId: string,
  options?: { includePotential?: boolean; includeLayout?: boolean },
): Promise<string[]> {
  if (!theme.globals || !theme.globals.configs) {
    await theme.initGlobals(pageId || 'index');
  }

  const pages: SwellAppStorefrontThemePage[] = Array.isArray(theme.props.pages)
    ? theme.props.pages
    : [];
  const page = pages.find((p) => p.id === pageId);

  const deps = new Set<string>();

  if (page?.collection) {
    deps.add(page.collection);
  } else if (page?.record) {
    const mapped = mapRecordToCollection(theme, String(page.record));
    if (mapped) deps.add(mapped);
  }

  // Resolve template config for this page
  const config = await resolveTemplateConfig(theme, pageId);

  if (config?.file_path?.endsWith('.json')) {
    const group = parseSectionGroup(config.file_data);
    if (group) {
      const sections = await theme.getPageSections(group, true);
      collectFromSections(sections, deps);
    }
  } else if (pageId === 'index') {
    try {
      const sections = await theme.getShopify1HomePageSections(true);
      collectFromSections(sections, deps);
    } catch {
      // ignore
    }
  }

  // Optionally include layout/global section groups (header, footer, etc.)
  if (options?.includeLayout) {
    try {
      // Resolve page layout groups and compute a stable cache key by sources
      const pageGroups = await theme.getPageSectionGroups(pageId);
      const sources = pageGroups
        .map((g) => g.source)
        .filter(Boolean)
        .sort();
      const cacheKey = JSON.stringify(sources);

      const themeCache = getLayoutDepsCache(theme);
      const cached = themeCache.get(cacheKey);
      if (cached) {
        for (const c of cached) deps.add(c);
      } else {
        const layoutGroups = await theme.getLayoutSectionGroups(
          pageGroups,
          true,
        );
        const layoutDeps = new Set<string>();
        for (const group of layoutGroups) {
          for (const section of group.sectionConfigs) {
            const settings = (section.settings?.section?.settings ||
              {}) as Record<string, unknown>;
            scanResolvedValuesForCollections(settings, layoutDeps);
            const blocks = section.settings?.section?.blocks || [];
            for (const block of blocks) {
              scanResolvedValuesForCollections(
                (block?.settings || {}) as Record<string, unknown>,
                layoutDeps,
              );
            }
          }
        }
        const list = Array.from(layoutDeps).sort();
        themeCache.set(cacheKey, list);
        for (const c of list) deps.add(c);
      }
    } catch {
      // noop
    }
  }

  // Optionally seed potential deps from Shopify page_resources
  if (options?.includePotential && theme.shopifyCompatibility) {
    const pageType = theme.shopifyCompatibility.getPageType(pageId);
    const pageResources = theme.shopifyCompatibility.getPageResourceMap();
    const entry = pageResources.get(pageType);
    if (entry?.resources) {
      for (const res of entry.resources) {
        const maybe = mapPotentialFromToCollection(theme, pageType, res.from);
        if (maybe) deps.add(maybe);
      }
    }
  }

  return Array.from(deps).sort();
}

function mapRecordToCollection(
  theme: SwellTheme,
  record: string,
): string | null {
  const rec = String(record).toLowerCase();
  const available = new Set<string>(
    Object.keys((theme.resources?.records as Record<string, unknown>) || {}),
  );

  const candidates = getCollectionCandidatesForKey(rec);
  if (candidates) {
    for (const c of candidates) {
      if (available.has(c)) return c;
    }
  }

  const plural = rec.endsWith('s') ? rec : `${rec}s`;
  if (available.has(plural)) return plural;

  // Probe common content/* namespaces for custom models
  const contentCandidates = [`content/${rec}`, `content/${plural}`];
  for (const c of contentCandidates) {
    if (available.has(c)) return c;
  }

  return null;
}

function mapPotentialFromToCollection(
  theme: SwellTheme,
  pageType: string,
  from: string,
): string | null {
  const available = new Set<string>(
    Object.keys((theme.resources?.records as Record<string, unknown>) || {}),
  );

  const key = String(from).toLowerCase();

  const candidates = getCollectionCandidatesForKey(key);
  if (candidates) {
    for (const c of candidates) {
      if (available.has(c)) return c;
    }
  }

  return null;
}

// Helper: resolve a page template config using the same path as renderer
export async function resolveTemplateConfig(
  theme: SwellTheme,
  pageId: string,
): Promise<{ file_path?: string | null; file_data?: string | null } | null> {
  try {
    const filePath = theme.getPageConfigPath(pageId);
    if (filePath) {
      const config = await theme.getThemeConfig(filePath);
      if (config) return config as any;
    }
  } catch {
    // noop
  }

  const fallback = (await theme.getThemeTemplateConfigByType(
    'templates',
    pageId,
  )) as { file_path?: string | null; file_data?: string | null } | null;
  return fallback;
}

// Helper: scan any resolved settings object/array/resource for collection usage
export function scanResolvedValuesForCollections(
  input: unknown,
  into?: Set<string>,
): Set<string> {
  const deps = into || new Set<string>();
  collectCollectionsFromResolvedValues(input, deps);
  return deps;
}

// Shared alias resolver used for both record and potential mapping
function getCollectionCandidatesForKey(key: string): string[] | undefined {
  switch (key) {
    case 'product':
    case 'products':
      return ['products'];
    case 'category':
    case 'categories':
      return ['categories'];
    case 'page':
    case 'pages':
      return ['content/pages', 'pages'];
    case 'blog':
    case 'blogs':
      return ['content/blogs', 'blogs'];
    case 'cart':
    case 'carts':
      return ['carts'];
    case 'order':
    case 'orders':
      return ['orders'];
    case 'subscription':
    case 'subscriptions':
      return ['subscriptions'];
    case 'account':
    case 'accounts':
      return ['accounts'];
    default:
      return undefined;
  }
}

// Per-theme memoization for layout/global section dependency lists within a request
const __layoutDepsCache = new WeakMap<SwellTheme, Map<string, string[]>>();
function getLayoutDepsCache(theme: SwellTheme): Map<string, string[]> {
  let cache = __layoutDepsCache.get(theme);
  if (!cache) {
    cache = new Map<string, string[]>();
    __layoutDepsCache.set(theme, cache);
  }
  return cache;
}

function parseSectionGroup(fileData?: string | null): ThemeSectionGroup | null {
  if (!fileData) return null;
  try {
    const json = JSON5.parse<ThemePageTemplateConfig>(fileData || '{}');
    if (json && typeof json === 'object' && (json as any).sections) {
      return {
        sections: (json as any).sections,
        order: (json as any).order,
        type: (json as any).type,
        label: (json as any).label,
      } as ThemeSectionGroup;
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

function collectFromSections(
  sections: ThemeSectionConfig[],
  deps: Set<string>,
): void {
  for (const section of sections) {
    const settings = (section.settings?.section?.settings || {}) as Record<
      string,
      unknown
    >;
    collectCollectionsFromResolvedValues(settings, deps);

    const blocks = section.settings?.section?.blocks || [];
    for (const block of blocks) {
      collectCollectionsFromResolvedValues(
        (block?.settings || {}) as Record<string, unknown>,
        deps,
      );
    }
  }
}

function collectCollectionsFromResolvedValues(
  input: unknown,
  deps: Set<string>,
) {
  if (input instanceof StorefrontResource) {
    const collection = getStorefrontResourceCollection(input);
    if (collection) deps.add(collection);
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectCollectionsFromResolvedValues(item, deps);
    }
    return;
  }

  if (input && typeof input === 'object') {
    for (const value of Object.values(input as Record<string, unknown>)) {
      collectCollectionsFromResolvedValues(value, deps);
    }
  }
}
