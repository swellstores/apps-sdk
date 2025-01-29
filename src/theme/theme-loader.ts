import bluebird from 'bluebird';

const { Promise } = bluebird;

import { Swell } from '@/api';
import { ThemeCache } from '../cache';
import { FILE_DATA_INCLUDE_QUERY } from '../constants';

import type {
  SwellCollection,
  SwellThemeConfig,
  SwellThemeManifest,
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

  constructor(swell: Swell) {
    this.swell = swell;
  }

  /**
   * Loads theme configs for this version.
   */
  async loadTheme() : Promise<SwellThemeConfig[]> {
    // TODO: This will eventually be replaced by loadThemeFromManifest
    // return this.loadThemeFromManifest();
    return this.loadThemeAllConfigs();
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

    const configs = await this.getCache().fetch<SwellCollection<SwellThemeConfig>>(
      `configs-all:${this.swell.instanceId}:v@${configVersion}`,
      () => this.fetchThemeConfigsFromSource(),
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
  private async loadThemeFromManifest() : Promise<SwellThemeConfig[]> {
    // Fetch the manifest, which contains a list of theme configs
    const manifest = await this.fetchManifest();
    if (!manifest) {
      throw new Error(`Failed to resolve manifest: ${this.swell.instanceId}`);
    }

    // Determine which configs we already have, and which we do not have.
    const configHashesUnresolved : string[] = [];              // tracks unresolved configs
    const configsByHash = new Map<string, SwellThemeConfig>(); // tracks resolved configs
    await Promise.map(
      Object.values(manifest),
      (configHash) => {
        return this.getCache().get<SwellThemeConfig>(`config:${configHash}`)
          .then((config) => {
            if (config) {
              configsByHash.set(config.hash, config);
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
      const newConfigs : SwellThemeConfig[] = configs?.results ?? [];

      for (const config of newConfigs) {
        configsByHash.set(config.hash, config);
      }

      // Cache the newly resolved theme configs.
      await Promise.map(
        newConfigs,
        (config) => this.getCache().set(`config:${config.hash}`, config),
        { concurrency: 10 },
      );
    }

    return Array.from(configsByHash.values());
  }

  /**
   * Fetches the manifest (set of config hashes) for a theme version.
   */
  private async fetchManifest() : Promise<SwellThemeManifest | null> {
    const { swellHeaders } = this.swell;

    const versionHash = swellHeaders['theme-version-hash'];

    let manifest = await this.getCache()
      .get<SwellThemeManifest>(`manifest:${versionHash}`);

    if (!manifest) {
      // No cached manifest. Ignore the hash and fetch the latest
      // manifest from source.
      const themeVersion = await this.swell.get(
        '/:themes:versions/:last',
        {
          ...this.themeVersionQueryFilter(),
          fields: 'hash, manifest',
        }
      );

      if (themeVersion) {
        // Cache the latest manifest.
        await this.getCache().set(
          `manifest:${themeVersion.hash}`,
          themeVersion.manifest,
        );

        manifest = themeVersion.manifest;
      }
    }

    return manifest;
  }

  /**
   * Fetches theme configs via Swell Backend API.
   */
  private async fetchThemeConfigsFromSource(configHashes: string[] | undefined = undefined) : Promise<SwellCollection<SwellThemeConfig>> {
    configHashes = configHashes || [];

    const { swellHeaders } = this.swell;

    const version = String(swellHeaders['theme-config-version']);

    // Determine whether we need to fetch all or just some of the theme configs.
    // If no configs are specified, then fetch them all.
    // If the # of configs exceeds N, just fetch them all.
    const fetchAll = configHashes.length === 0 || configHashes.length > MAX_INDIVIDUAL_CONFIGS_TO_FETCH;

    console.log(
      `Retrieving ${fetchAll ? 'all' : 'some'} theme configurations - version: ${version}`,
    );

    const configs = await this.swell.get('/:themes:configs', {
      ...this.themeVersionQueryFilter(),
      ...(fetchAll ? {} : { hash: { $in: configHashes } }),
      // TODO: paginate to support more than 1000 configs
      limit: 1000,
      fields: 'type, name, file, file_path',
      include: {
        file_data: FILE_DATA_INCLUDE_QUERY,
      },
    });

    return configs as SwellCollection<SwellThemeConfig>;
  }

  /**
   * Generates a Swell API query filter for this theme version. 
   */ 
  private themeVersionQueryFilter() : Record<string, unknown> {
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

  private getCache() {
    if (!ThemeLoader.cache) {
      ThemeLoader.cache = new ThemeCache(this.swell.workerEnv?.THEME);
    }
    return ThemeLoader.cache;
  }
}
