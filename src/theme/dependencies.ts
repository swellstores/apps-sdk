// Route dependency resolution utilities for theme templates
// Provides collection dependency detection without fetching data

import JSON5 from 'json5';

import type { SwellTheme } from '../theme';
import type {
  ThemePageTemplateConfig,
  ThemeSectionConfig,
  ThemeSectionGroup,
} from 'types/swell';
import type {
  SwellAppStorefrontThemePage,
  SwellThemeConfig,
} from 'types/swell';
import {
  StorefrontResource,
  getStorefrontResourceCollection,
} from '../resources';

// Cache of type->collection maps per theme instance
const __typeCollectionMapCache = new WeakMap<SwellTheme, Map<string, string>>();

// Builds a type→collection map with stable aliases.
// Precedence with mapping helpers:
// 1) Direct resource keys (handled in mapRecordToCollection/mapPotentialFromToCollection)
// 2) template_collections inversion (type → collection)
//    - also include the collection key itself and its last path segment as aliases
function getTypeToCollectionMap(theme: SwellTheme): Map<string, string> {
  let map = __typeCollectionMapCache.get(theme);
  if (map) return map;

  map = new Map<string, string>();

  const templateCollections = theme.props?.template_collections || {};
  for (const [collection, templateId] of Object.entries(templateCollections)) {
    // templateId example: "products/product" -> typeName "product"
    const typeName = String(templateId).split('/').pop()?.trim().toLowerCase();
    if (typeName) {
      map.set(typeName, collection);
    }
    // Add stable aliases to avoid brittle heuristics
    const colKey = String(collection).toLowerCase();
    map.set(colKey, collection); // allow direct collection key lookup
    const colBase = colKey.split('/').pop();
    if (colBase) map.set(colBase, collection); // allow using last segment (e.g., pages, blogs)
  }

  __typeCollectionMapCache.set(theme, map);
  return map;
}

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
    // Enumerate all template variants for this page base and union dependencies
    const basePath = getPageBasePath(theme, pageId);
    const variants = await listTemplateVariantConfigs(theme, basePath);
    for (const v of variants) {
      const group = parseSectionGroup(v.file_data);
      if (group) {
        const sections = await theme.getPageSections(group, true);
        collectFromSections(sections, deps);
      }
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
      // Enumerate template variants and union layout/global section dependencies
      const basePath = getPageBasePath(theme, pageId);
      const variants = await listTemplateVariantConfigs(theme, basePath);

      for (const v of variants) {
        const alt = getAltTemplateSuffix(basePath, v.file_path);

        // Resolve page layout groups for the specific variant and compute a stable cache key by sources
        const pageGroups = await theme.getPageSectionGroups(pageId, alt);
        const sources = pageGroups
          .map((g) => g.source)
          .filter(Boolean)
          .sort();
        const cacheKey = JSON.stringify([v.file_path, ...sources]);

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
  const resources = (theme.resources?.records || {}) as Record<string, unknown>;
  if (rec in resources) return rec;

  const map = getTypeToCollectionMap(theme);
  return map.get(rec) || null;
}

function mapPotentialFromToCollection(
  theme: SwellTheme,
  pageType: string,
  from: string,
): string | null {
  const key = String(from).toLowerCase();
  const resources = (theme.resources?.records || {}) as Record<string, unknown>;
  if (key in resources) return key;

  const map = getTypeToCollectionMap(theme);
  return map.get(key) || null;
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

// Variant enumeration helpers
const __templateVariantCache = new WeakMap<
  SwellTheme,
  Map<string, SwellThemeConfig[]>
>();

// Resolves the base template path for a given pageId, respecting Shopify compatibility mapping.
function getPageBasePath(theme: SwellTheme, pageId: string): string {
  const raw = theme.getPageConfigPath(pageId) || '';
  return raw.replace(/\.json$/i, '');
}

// Lists the JSON template config variants for a base template path.
// Includes the base file and any `${base}.*.json` variants.
async function listTemplateVariantConfigs(
  theme: SwellTheme,
  basePath: string,
): Promise<SwellThemeConfig[]> {
  // Keep async signature and satisfy lint rule while relying on sync access
  await Promise.resolve();

  let cache = __templateVariantCache.get(theme);
  if (!cache) {
    cache = new Map<string, SwellThemeConfig[]>();
    __templateVariantCache.set(theme, cache);
  }

  const cached = cache.get(basePath);
  if (cached) return cached;

  const configs = theme.getThemeConfigsByPath('theme/templates/', '.json');

  const variants: SwellThemeConfig[] = [];
  const base = basePath.endsWith('.json') ? basePath.slice(0, -5) : basePath;
  const exact = `${base}.json`;
  const dotPrefix = `${base}.`;

  for (const cfg of configs.values()) {
    const fp = cfg.file_path;
    if (fp === exact || (fp.startsWith(dotPrefix) && fp.endsWith('.json'))) {
      variants.push(cfg);
    }
  }

  // Sort for stability
  variants.sort((a, b) =>
    a.file_path < b.file_path ? -1 : a.file_path > b.file_path ? 1 : 0,
  );

  cache.set(basePath, variants);
  return variants;
}

// Computes the altTemplate suffix from a variant file path.
function getAltTemplateSuffix(
  basePath: string,
  filePath: string,
): string | undefined {
  const base = basePath.endsWith('.json') ? basePath.slice(0, -5) : basePath;
  if (filePath === `${base}.json`) return undefined;
  if (filePath.startsWith(`${base}.`) && filePath.endsWith('.json')) {
    const rest = filePath.slice(base.length + 1, -5);
    return rest || undefined;
  }
  return undefined;
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
