import bluebird from 'bluebird';

const { Promise } = bluebird;

import { ThemeCache } from '../cache';
import { FILE_DATA_INCLUDE_QUERY } from '../constants';

import type { Swell } from '@/api';
import type {
  SwellCollection,
  SwellThemeConfig,
  SwellThemeManifest,
  SwellThemePreload,
  SwellThemeVersion,
} from 'types/swell';

// Max individual theme configs to fetch from source. If threshold is exceeded,
// just fetch all configs from source.
const MAX_INDIVIDUAL_CONFIGS_TO_FETCH = 50;

/**
 * Responsible for loading a theme.
 */
export class ThemeLoader {
  private static cache: ThemeCache | null = null;

  private swell: Swell;
  private manifest: Map<string, string> | null;
  private configs: Map<string, SwellThemeConfig>;
  private configPaths: string[];

  constructor(swell: Swell) {
    this.swell = swell;
    this.manifest = null;
    this.configs = new Map();
    this.configPaths = [];
  }

  async init(themeConfigs?: Map<string, SwellThemeConfig>): Promise<void> {
    if (themeConfigs) {
      this.setConfigs(themeConfigs);
      return;
    }

    if (!this.getThemeId()) {
      return;
    }

    await this.fetchManifest();

    if (this.manifest === null) {
      console.log('ThemeLoader.init - version manifest not found');
      await this.loadTheme();
    }
  }

  /**
   * Loads theme configs for this version.
   */
  async loadTheme(): Promise<SwellThemeConfig[]> {
    const { swellHeaders } = this.swell;

    console.log('ThemeLoader.loadTheme', swellHeaders['theme-version-hash']);

    if (swellHeaders['theme-version-hash']) {
      const configs = await this.loadThemeFromManifest();
      if (configs) {
        return configs;
      }
    }

    return this.loadThemeAllConfigs();
  }

  /**
   * Returns the cache instance for this theme loader.
   */
  getCache(): ThemeCache {
    if (ThemeLoader.cache === null) {
      ThemeLoader.cache = new ThemeCache({
        kvStore: this.swell.workerEnv?.THEME,
      });
    }

    return ThemeLoader.cache;
  }

  /**
   * Load theme configs from internal data, typically in the editor.
   */
  setConfigs(themeConfigs: Map<string, SwellThemeConfig>): void {
    this.configs = new Map(themeConfigs);
    this.manifest = new Map<string, string>();

    for (const { file_path, hash } of this.configs.values()) {
      this.manifest.set(file_path, hash);
    }

    this.configPaths = Array.from(this.configs.keys());
  }

  /**
   * Preloads a theme version and configs. This is used to optimize initial theme load.
   */
  async preloadTheme(payload: SwellThemePreload): Promise<void> {
    const { version, configs } = payload;

    console.log(
      `ThemeLoader.preloadTheme${version?.hash ? ` - manifest: ${version.hash}` : ''}${configs?.length ? ` - configs: ${configs.length}` : ''}`,
    );

    const promises: Promise<unknown>[] = [];

    if (version) {
      promises.push(this.cacheManifest(version));
    }

    if (configs) {
      const themeId = this.getThemeId();

      promises.push(
        Promise.map(
          configs,
          async (config) => {
            const promises: Promise<unknown>[] = [
              this.cacheThemeConfig(config),
            ];

            if (themeId && config.file?.url) {
              promises.push(
                this.cacheThemeFileUrl(themeId, config.hash, config.file.url),
              );
            }

            await Promise.all(promises);
          },
          { concurrency: 10 },
        ),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Fetches a theme config by file path.
   */
  async fetchThemeConfig(filePath: string): Promise<SwellThemeConfig | null> {
    const themeConfig = this.configs.get(filePath);

    if (themeConfig !== undefined) {
      return themeConfig;
    }

    const hash = this.manifest?.get(filePath);

    if (!hash) {
      return null;
    }

    const cache = this.getCache();
    let config = await cache.get<SwellThemeConfig>(`config:${hash}`);

    if (config) {
      const themeId = this.getThemeId();

      if (themeId && config.file?.url) {
        const fileUrl = await cache.get<string>(
          `file:${themeId}:${config.hash}`,
        );

        if (fileUrl) {
          config = { ...config, file: { ...config.file, url: fileUrl } };
        }
      }

      this.configs.set(filePath, config);
      return config;
    }

    return this.fetchThemeConfigsFromSourceByPath(filePath, hash);
  }

  async fetchThemeConfigsByPath(
    pathPrefix: string,
    pathSuffix?: string,
  ): Promise<SwellThemeConfig[]> {
    const paths = this.configPaths.filter(
      (path) =>
        path.startsWith(pathPrefix) &&
        (!pathSuffix || path.endsWith(pathSuffix)),
    );

    const configs = await Promise.map(
      paths,
      (path) => this.fetchThemeConfig(path),
      { concurrency: 10 },
    );

    return configs.filter<SwellThemeConfig>((config) => config !== null);
  }

  /**
   * Load all theme configs.
   */
  private async loadThemeAllConfigs(): Promise<SwellThemeConfig[]> {
    const { swellHeaders } = this.swell;

    const configVersion = String(swellHeaders['theme-config-version']);
    if (!configVersion) {
      throw new Error('Theme version is required');
    }

    const configs = await this.getCache().fetch<
      SwellCollection<SwellThemeConfig>
    >(`configs-all:${this.swell.instanceId}:v@${configVersion}2`, () =>
      this.fetchThemeConfigsFromSource(),
    );

    return configs?.results ?? [];
  }

  /**
   * Load theme configs via manifest.
   *
   * This approach has the following optimizations:
   *   - cached manifests and configs can be shared by other clients
   *   - when fetching from source, only fetch the missing records
   */
  private async loadThemeFromManifest(): Promise<SwellThemeConfig[] | null> {
    // Fetch the manifest, which contains a list of theme configs
    const manifest = await this.fetchManifest();
    if (!manifest) {
      return null; // Fall back to fetching all configs
    }

    // Determine which configs we already have, and which we do not have.
    const configHashesUnresolved: string[] = []; // tracks unresolved configs
    const configsByHash = new Map<string, SwellThemeConfig>(); // tracks resolved configs
    const themeId = this.getThemeId();
    const cache = this.getCache();

    await Promise.map(
      manifest.values(),
      async (configHash) => {
        let config = await cache.get<SwellThemeConfig>(`config:${configHash}`);

        if (!config) {
          configHashesUnresolved.push(configHash);
          return;
        }

        if (themeId && config.file?.url) {
          const fileUrl = await cache.get<string>(
            `file:${themeId}:${configHash}`,
          );

          if (fileUrl) {
            config = { ...config, file: { ...config.file, url: fileUrl } };
          }
        }

        configsByHash.set(config.hash, config);
        this.configs.set(config.file_path, config);
      },
      { concurrency: 10 },
    );

    // Fetch remaining unresolved configs from source.
    if (configHashesUnresolved.length > 0) {
      // Missing some/all configs. Fetch them from source.
      const configs = await this.fetchThemeConfigsFromSource(
        // If no configs were resolved, then fetch them all. otherwise fetch
        // the specific subset of configs.
        configsByHash.size === 0 ? undefined : configHashesUnresolved,
      );
      const newConfigs: SwellThemeConfig[] = configs?.results ?? [];

      for (const config of newConfigs) {
        configsByHash.set(config.hash, config);
        this.configs.set(config.file_path, config);
      }

      // Cache the newly resolved theme configs.
      await Promise.map(
        newConfigs,
        async (config) => {
          const promises: Promise<unknown>[] = [this.cacheThemeConfig(config)];

          if (themeId && config.file?.url) {
            promises.push(
              this.cacheThemeFileUrl(themeId, config.hash, config.file.url),
            );
          }

          await Promise.all(promises);
        },
        { concurrency: 10 },
      );
    }

    return Array.from(configsByHash.values());
  }

  /**
   * Caches a theme version manifest by hash.
   */
  private async cacheManifest(version: SwellThemeVersion): Promise<void> {
    if (version?.hash) {
      await this.getCache().set(`manifest:${version.hash}`, version.manifest);
    }
  }

  /**
   * Caches a theme config by hash.
   */
  private async cacheThemeConfig(config: SwellThemeConfig): Promise<void> {
    if (config?.hash) {
      await this.getCache().set(`config:${config.hash}`, config);
    }
  }

  /**
   * Caches a CDN file url by config hash.
   */
  private async cacheThemeFileUrl(
    themeId: string,
    configHash: string,
    fileUrl: string,
  ): Promise<void> {
    await this.getCache().set(`file:${themeId}:${configHash}`, fileUrl);
  }

  /**
   * Fetches the manifest (set of config hashes) for a theme version.
   */
  private async fetchManifest(): Promise<Map<string, string> | null> {
    const { swellHeaders } = this.swell;

    const versionHash = swellHeaders['theme-version-hash'];

    console.log('ThemeLoader.fetchManifest', versionHash);

    let manifest = await this.getCache().get<SwellThemeManifest>(
      `manifest:${versionHash}`,
    );

    if (!manifest) {
      // No cached manifest. Ignore the hash and fetch the latest
      // manifest from source.
      const themeVersion = await this.swell.get<SwellThemeVersion>(
        '/:themes:versions/:last',
        {
          ...this.themeVersionQueryFilter(),
          fields: 'hash, manifest',
        },
      );

      if (themeVersion) {
        // Cache the latest manifest.
        await this.cacheManifest(themeVersion);

        manifest = themeVersion.manifest;
      }
    }

    // Save manifest for individual lookups
    if (manifest) {
      this.manifest = new Map<string, string>(Object.entries(manifest));
      this.configPaths = [...this.manifest.keys()];
    }

    return this.manifest;
  }

  /**
   * Fetches many theme configs via Swell Backend API.
   */
  private async fetchThemeConfigsFromSource(
    configHashes: string[] | undefined = undefined,
  ): Promise<SwellCollection<SwellThemeConfig>> {
    configHashes = configHashes || [];

    const { swellHeaders } = this.swell;

    const version = String(swellHeaders['theme-config-version']);

    // Determine whether we need to fetch all or just some of the theme configs.
    // If no configs are specified, then fetch them all.
    // If the # of configs exceeds N, just fetch them all.
    const fetchAll =
      configHashes.length === 0 ||
      configHashes.length > MAX_INDIVIDUAL_CONFIGS_TO_FETCH;

    console.log(
      `Retrieving ${fetchAll ? 'all' : 'some'} theme configurations - version: ${version}`,
    );

    const configs = await this.swell.get<SwellCollection<SwellThemeConfig>>(
      '/:themes:configs',
      {
        ...this.themeVersionQueryFilter(),
        ...(fetchAll ? undefined : { hash: { $in: configHashes } }),
        // TODO: paginate to support more than 1000 configs
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
   * Fetches one theme config via Swell Backend API.
   * This is used when a hash entry cannot be found.
   * We may override the cached hash in order to ensure it is found on reload,
   * but we probably need to find why that happens in the first place (TODO).
   */
  private async fetchThemeConfigsFromSourceByPath(
    filePath: string,
    hash?: string,
  ): Promise<SwellThemeConfig | null> {
    console.log(`Retrieving theme config - ${filePath}`);

    const config = await this.swell.get<SwellThemeConfig>(
      '/:themes:configs/:last',
      {
        ...this.themeVersionQueryFilter(),
        file_path: filePath,
        fields: 'name, file, file_path, hash',
        include: {
          file_data: FILE_DATA_INCLUDE_QUERY,
        },
      },
    );

    if (config) {
      this.configs.set(filePath, config);

      if (hash) {
        // Override hash to ensure cache exists next round
        config.hash = hash;
      }

      const themeId = this.getThemeId();
      const promises: Promise<unknown>[] = [this.cacheThemeConfig(config)];

      if (themeId && config.file?.url) {
        promises.push(
          this.cacheThemeFileUrl(themeId, config.hash, config.file.url),
        );
      }

      await Promise.all(promises);
    }

    return config ?? null;
  }

  private getThemeId(): string | undefined {
    return this.swell.swellHeaders['theme-id'];
  }

  /**
   * Generates a Swell API query filter for this theme version.
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
}
