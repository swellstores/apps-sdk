import { FILE_DATA_INCLUDE_QUERY } from '../constants';
import { logger, createTraceId } from '../utils/logger';
import { getKVFlavor } from '../utils/kv-flavor';
import { md5 } from '../utils';

import type { Swell } from '@/api';
import { ThemeFileStorage, ThemeCache } from '../cache';
import type { PutFilesResult } from '../cache';
import type {
  SwellCollection,
  SwellThemeConfig,
  SwellThemePreload,
} from 'types/swell';

// Max individual theme configs to fetch from source when fetching missing data
const MAX_INDIVIDUAL_CONFIGS_TO_FETCH = 50;

/**
 * Responsible for loading and managing theme configurations.
 * Uses a single batch loading strategy for optimal performance.
 */
export class ThemeLoader {
  private static cache: ThemeCache | null = null;
  private swell: Swell;
  private configs: Map<string, SwellThemeConfig>;

  constructor(swell: Swell) {
    this.swell = swell;
    this.configs = new Map();
  }

  /**
   * Initialize the theme loader with all configurations.
   * Either uses provided configs (editor mode) or loads from storage.
   */
  async init(themeConfigs?: Map<string, SwellThemeConfig>): Promise<void> {
    if (themeConfigs) {
      this.setConfigs(themeConfigs);
      return;
    }

    if (!this.getThemeId()) {
      logger.debug('[ThemeLoader] No theme ID, skipping init');
      return;
    }

    await this.loadAllConfigs();

    logger.info('[ThemeLoader] Initialization complete', {
      configCount: this.configs.size,
      themeId: this.getThemeId(),
    });
  }

  /**
   * Get a single config by file path (synchronous).
   * Returns null if config not found.
   */
  getConfig(filePath: string): SwellThemeConfig | null {
    return this.configs.get(filePath) ?? null;
  }

  /**
   * Get all loaded configs.
   * Used by theme getter to expose configs to editor/tests.
   */
  getConfigs(): Map<string, SwellThemeConfig> {
    return this.configs;
  }

  /**
   * Get multiple configs by path pattern (synchronous).
   * Filters configs by prefix and optional suffix.
   */
  getConfigsByPath(
    pathPrefix: string,
    pathSuffix?: string,
  ): SwellThemeConfig[] {
    const results: SwellThemeConfig[] = [];
    for (const [path, config] of this.configs) {
      if (
        path.startsWith(pathPrefix) &&
        (!pathSuffix || path.endsWith(pathSuffix))
      ) {
        results.push(config);
      }
    }
    return results;
  }

  /**
   * Load theme configs from internal data, typically in the editor.
   * Used when configs are provided externally (e.g., from editor).
   */
  setConfigs(themeConfigs: Map<string, SwellThemeConfig>): void {
    this.configs = new Map(themeConfigs);
  }

  /**
   * Updates KV with file_data for provided theme configs (warmup path).
   * Uses the new ThemeFileStorage abstraction for optimized operations.
   */
  async updateThemeCache(payload: SwellThemePreload): Promise<PutFilesResult> {
    const configs = payload?.configs || [];

    if (configs.length === 0) {
      logger.debug('[ThemeLoader] No configs to cache');
      return {
        written: 0,
        skipped: 0,
        skippedExisting: 0,
        warnings: [],
      };
    }

    // Use centralized KV flavor detection
    const flavor = getKVFlavor(this.swell.workerEnv);
    const trace = createTraceId();
    logger.info('[ThemeLoader] Starting theme cache update', {
      totalConfigs: configs.length,
      flavor,
      trace,
    });

    const storage = new ThemeFileStorage(this.swell.workerEnv, flavor);
    const result = await storage.putFiles(configs);

    // Log summary with appropriate level based on results
    if (result.warnings.length > 0) {
      logger.warn('[ThemeLoader] Theme cache updated with warnings', {
        total: configs.length,
        written: result.written,
        skipped: result.skipped,
        skippedExisting: result.skippedExisting,
        warnings: result.warnings.length,
        trace,
      });
    } else {
      logger.info('[ThemeLoader] Theme cache updated successfully', {
        total: configs.length,
        written: result.written,
        skipped: result.skipped,
        skippedExisting: result.skippedExisting,
        trace,
      });
    }

    return result;
  }

  /**
   * Main loading logic - loads all configs at once.
   * 1. Fetches lightweight metadata (cached when possible)
   * 2. Batch hydrates file_data from KV
   * 3. Fetches missing file_data from API if needed
   */
  private async loadAllConfigs(): Promise<void> {
    // Step 1: Get lightweight metadata (cached when possible)
    const configMetadata = await this.fetchConfigMetadata();

    if (configMetadata.length === 0) {
      logger.warn('[ThemeLoader] No configs found');
      return;
    }

    logger.debug('[ThemeLoader] Loading configs', {
      total: configMetadata.length,
    });

    // Step 2: Batch hydrate file_data from KV
    const flavor = getKVFlavor(this.swell.workerEnv);
    const storage = new ThemeFileStorage(this.swell.workerEnv, flavor);
    const kvHydrated = await storage.getFiles(configMetadata);

    // Step 3: Ensure all configs have data (fetch missing from API if needed)
    const completeConfigs = await this.ensureConfigsHaveData(kvHydrated);

    // Step 4: Store in memory for fast access
    for (const config of completeConfigs) {
      this.configs.set(config.file_path, config);
    }

    logger.info('[ThemeLoader] All configs loaded', {
      total: completeConfigs.length,
      withData: completeConfigs.filter((c) => c.file_data).length,
    });
  }

  /**
   * Fetch lightweight config metadata from API or cache.
   * Does NOT include file_data to minimize payload size.
   */
  private async fetchConfigMetadata(): Promise<SwellThemeConfig[]> {
    const query = {
      ...this.themeVersionQueryFilter(),
      limit: 1000,
      type: 'theme',
      fields: 'id, name, type, file, file_path, hash',
    };

    const versionHash = this.swell.swellHeaders['theme-version-hash'];
    const cacheKey = this.buildMetadataCacheKey(versionHash, query);
    const cache = this.getCache();

    // Check cache first - version-based, valid forever for that version
    const cached = await cache.get<SwellThemeConfig[]>(cacheKey);
    if (cached) {
      logger.debug('[ThemeLoader] Config metadata cache hit');
      return cached;
    }

    logger.debug('[ThemeLoader] Fetching config metadata from API');
    const response = await this.swell.get<SwellCollection<SwellThemeConfig>>(
      '/:themes:configs',
      query,
    );

    const configs = response?.results || [];

    // Cache for this version
    await cache.set(cacheKey, configs);

    return configs;
  }

  /**
   * Helper to ensure all configs have file_data.
   * Fetches missing data from API and updates KV cache.
   */
  private async ensureConfigsHaveData(
    configs: SwellThemeConfig[],
  ): Promise<SwellThemeConfig[]> {
    const missingData = configs.filter((c) => !c.file_data);

    if (missingData.length === 0) {
      logger.debug('[ThemeLoader] All configs have file_data from KV');
      return configs;
    }

    const trace = createTraceId();

    logger.info(
      `[ThemeLoader] Loading ${missingData.length} missing file_data from API`,
      {
        trace,
      },
    );

    // Fetch from API with file_data
    const hashes = missingData.map((c) => c.hash);
    const apiResponse = await this.fetchThemeConfigsFromSource(hashes);
    const fetched = apiResponse.results || [];

    logger.info(`[ThemeLoader] Fetched ${fetched.length} configs from API`, {
      trace,
    });

    // Cache for next time
    if (fetched.length > 0) {
      const cacheResult = await this.updateThemeCache({
        api: 1, // Required by SwellThemePreload type
        configs: fetched,
      });

      if (cacheResult.warnings.length > 0) {
        logger.warn('[ThemeLoader] Some files had size issues', {
          warnings: cacheResult.warnings.length,
        });
      }
    }

    // Merge results
    const fetchedMap = new Map(fetched.map((c) => [c.hash, c]));
    const mergedConfigs = configs.map((config) => {
      if (!config.file_data) {
        const withData = fetchedMap.get(config.hash);
        if (withData?.file_data) {
          return { ...config, file_data: withData.file_data };
        }
      }
      return config;
    });

    // Log final status
    const stillMissing = mergedConfigs.filter((c) => !c.file_data).length;
    if (stillMissing > 0) {
      logger.warn(
        `[ThemeLoader] ${stillMissing} configs still missing file_data after fetch`,
      );
    }

    return mergedConfigs;
  }

  /**
   * Fetches theme configs with file_data from Swell Backend API.
   * Used to retrieve missing file_data for configs.
   */
  private async fetchThemeConfigsFromSource(
    configHashes: string[] | undefined = undefined,
  ): Promise<SwellCollection<SwellThemeConfig>> {
    configHashes = configHashes || [];

    const { swellHeaders } = this.swell;
    const version = String(swellHeaders['theme-config-version']);

    // Determine whether we need to fetch all or just some of the theme configs
    const fetchAll =
      configHashes.length === 0 ||
      configHashes.length > MAX_INDIVIDUAL_CONFIGS_TO_FETCH;

    logger.debug(
      `[ThemeLoader] Fetching ${fetchAll ? 'all' : configHashes.length} configs with file_data`,
      { version },
    );

    const configs = await this.swell.get<SwellCollection<SwellThemeConfig>>(
      '/:themes:configs',
      {
        ...this.themeVersionQueryFilter(),
        ...(fetchAll ? undefined : { hash: { $in: configHashes } }),
        limit: 1000,
        type: 'theme',
        fields: 'name, file, file_path, hash',
        include: {
          file_data: FILE_DATA_INCLUDE_QUERY,
        },
      },
    );

    return configs as SwellCollection<SwellThemeConfig>;
  }

  /**
   * Get the current theme ID from headers.
   */
  private getThemeId(): string | undefined {
    return this.swell.swellHeaders['theme-id'];
  }

  /**
   * Generate a Swell API query filter for this theme version.
   */
  private themeVersionQueryFilter(): Record<string, unknown> {
    const { swellHeaders } = this.swell;
    const themeId = swellHeaders['theme-id'];

    if (!themeId) {
      throw new Error('Theme ID is required');
    }

    return {
      parent_id: themeId,
      branch_id: swellHeaders['theme-branch-id'] || null,
      preview:
        swellHeaders['deployment-mode'] === 'editor' ||
        swellHeaders['deployment-mode'] === 'preview'
          ? true
          : { $ne: true },
    };
  }

  /**
   * Build cache key with tenant isolation for metadata
   */
  private buildMetadataCacheKey(
    version: string | undefined,
    query: Record<string, unknown>,
  ): string {
    // Hash all args including instanceId for tenant isolation
    const args = [this.swell.instanceId, version || 'default', query];
    return `theme_configs:${md5(JSON.stringify(args))}`;
  }

  /**
   * Get or create the theme cache instance
   */
  private getCache(): ThemeCache {
    if (!ThemeLoader.cache) {
      ThemeLoader.cache = new ThemeCache({
        kvStore: this.swell.workerEnv?.THEME,
        workerCtx: this.swell.workerCtx,
      });
    }
    return ThemeLoader.cache;
  }
}
