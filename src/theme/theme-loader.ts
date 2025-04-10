import bluebird from 'bluebird';

const { Promise } = bluebird;

import { Swell } from '@/api';
import { ThemeCache } from '../cache';
import { FILE_DATA_INCLUDE_QUERY } from '../constants';

import type {
  SwellCollection,
  SwellThemeConfig,
  SwellThemeManifest,
  SwellThemeVersion,
} from 'types/swell';

// Max individual theme configs to fetch from source. If threshold is exceeded,
// just fetch all configs from source.
const MAX_INDIVIDUAL_CONFIGS_TO_FETCH = 50;

/**
 * Responsible for loading a theme.
 */
export class ThemeLoader {
  private static cache: ThemeCache;

  private swell: Swell;
  private manifest: SwellThemeManifest | null = null;
  private configs: { [key: string]: SwellThemeConfig | null } = {};
  private configPaths: string[] = [];

  constructor(swell: Swell) {
    this.swell = swell;
  }

  async init(themeConfigs?: Map<string, SwellThemeConfig>) {
    const { swellHeaders } = this.swell;

    if (themeConfigs) {
      this.setConfigs(themeConfigs);
      return;
    }

    if (!swellHeaders['theme-id']) {
      return;
    }

    await this.fetchManifest();

    if (!this.manifest) {
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
  getCache() {
    if (!ThemeLoader.cache) {
      ThemeLoader.cache = new ThemeCache({
        kvStore: this.swell.workerEnv?.THEME,
      });
    }
    return ThemeLoader.cache;
  }

  /**
   * Load theme configs from internal data, typically in the editor.
   */
  setConfigs(themeConfigs: Map<string, SwellThemeConfig>) {
    this.configs = Object.fromEntries(themeConfigs);
    this.configPaths = Object.keys(this.configs);
    this.manifest = this.configPaths.reduce((manifest, path) => {
      manifest[path] = this.configs[path]?.hash;
      return manifest;
    }, {} as SwellThemeManifest);
  }

  /**
   * Preloads a theme version and configs. This is used to optimize initial theme load.
   */
  async preloadTheme(
    version: SwellThemeVersion,
    configs: SwellThemeConfig[],
  ): Promise<void> {
    console.log(
      `ThemeLoader.preloadTheme${version?.hash ? ` - manifest: ${version.hash}` : ''}${configs?.length ? ` - configs: ${configs.length}` : ''}`,
    );

    await Promise.all([
      version && this.cacheManifest(version),
      configs &&
        Promise.map(configs, (config) => this.cacheThemeConfig(config), {
          concurrency: 10,
        }),
    ]);
  }

  /**
   * Fetches a theme config by file path.
   */
  async fetchThemeConfig(filePath: string): Promise<SwellThemeConfig | null> {
    if (this.configs[filePath] !== undefined) {
      return this.configs[filePath];
    }

    const hash = this.manifest?.[filePath];
    if (hash) {
      let config = await this.getCache().get<SwellThemeConfig>(
        `config:${hash}`,
      );
      if (config) {
        this.configs[filePath] = config;
        return config;
      }

      return this.fetchThemeConfigsFromSourceByPath(filePath, hash);
    }

    return null;
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
      {
        concurrency: 10,
      },
    );

    return configs.filter((config) => config !== null) as SwellThemeConfig[];
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
    await Promise.map(
      Object.values(manifest),
      (configHash) => {
        return this.getCache()
          .get<SwellThemeConfig>(`config:${configHash}`)
          .then((config) => {
            if (config) {
              configsByHash.set(config.hash, config);
              this.configs[config.file_path] = config;
            } else {
              configHashesUnresolved.push(configHash);
            }
          });
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
        this.configs[config.file_path] = config;
      }

      // Cache the newly resolved theme configs.
      await Promise.map(newConfigs, (config) => this.cacheThemeConfig(config), {
        concurrency: 10,
      });
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
   * Fetches the manifest (set of config hashes) for a theme version.
   */
  private async fetchManifest(): Promise<SwellThemeManifest | null> {
    const { swellHeaders } = this.swell;

    const versionHash = swellHeaders['theme-version-hash'];

    console.log('ThemeLoader.fetchManifest', versionHash);

    let manifest = await this.getCache().get<SwellThemeManifest>(
      `manifest:${versionHash}`,
    );

    if (!manifest) {
      // No cached manifest. Ignore the hash and fetch the latest
      // manifest from source.
      const themeVersion = (await this.swell.get('/:themes:versions/:last', {
        ...this.themeVersionQueryFilter(),
        fields: 'hash, manifest',
      })) as SwellThemeVersion;

      if (themeVersion) {
        // Cache the latest manifest.
        await this.cacheManifest(themeVersion);

        manifest = themeVersion.manifest;
      }
    }

    // Save manifest for individual lookups
    this.manifest = manifest;
    this.configPaths = Object.keys(manifest || {});

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

    const configs = await this.swell.get('/:themes:configs', {
      ...this.themeVersionQueryFilter(),
      ...(fetchAll ? {} : { hash: { $in: configHashes } }),
      // TODO: paginate to support more than 1000 configs
      limit: 1000,
      type: 'theme',
      fields: 'name, file, file_path, hash',
      include: {
        file_data: FILE_DATA_INCLUDE_QUERY,
      },
    });

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

    const config = (await this.swell.get('/:themes:configs/:last', {
      ...this.themeVersionQueryFilter(),
      file_path: filePath,
      fields: 'name, file, file_path, hash',
      include: {
        file_data: FILE_DATA_INCLUDE_QUERY,
      },
    })) as SwellThemeConfig | null;

    if (config) {
      if (hash) {
        // Override hash to ensure cache exists next round
        config.hash = hash;
      }
      await this.cacheThemeConfig(config);
    }

    this.configs[filePath] = config;

    return config;
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
