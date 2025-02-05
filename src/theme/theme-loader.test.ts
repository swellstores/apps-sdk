import { Swell } from '@/api';

import { ThemeLoader } from './theme-loader';

describe('#loadThemeFromManifest', () => {
  const configs = [
    {
      file_data: 'foo',
      hash: 'a',
    },
    {
      file_data: 'bar',
      hash: 'b',
    },
  ];

  let swell;
  let loader;

  beforeEach(() => {
    swell = new Swell({
      headers: {},
      swellHeaders: {
        'public-key': 'publickey',
        'store-id': 'test',
        'theme-id': 'themeid',
        'theme-version-hash': '####',
        'theme-config-version': 4,
      },
      url: new URL('https://storefront.app'),
    }); 

    loader = new ThemeLoader(swell);

    // Reset the theme cache.
    loader.getCache().flushAll();
  });

  it('loads a theme from source', async () => {
    jest.spyOn(swell, 'get').mockImplementation(async (url, data) => {
      switch (url) {
        case '/:themes:versions/:last': {
          // Simulate the manifest request
          return {
            hash: '####',
            manifest: { patha: 'a', pathb: 'b' },
          };
        }
        case '/:themes:configs': {
          // Simulate the theme config request
          return {
            results: configs,
          };
        }
        default: {
          throw new Error(`Unexpected url: ${url}`);
        }
      }
    });

    const theme = await loader.loadThemeFromManifest();

    expect(theme).toEqual(configs);

    expect(swell.get).toHaveBeenCalledWith(
      '/:themes:versions/:last',
      expect.objectContaining({
        parent_id: 'themeid',
        branch_id: null,
        preview: { $ne: true },
        fields: 'hash, manifest',
      }),
    );
  
    expect(swell.get).toHaveBeenCalledWith(
      '/:themes:configs',
      expect.objectContaining({
        parent_id: 'themeid',
        branch_id: null,
        preview: { $ne: true },
      }),
    );
    expect(swell.get).toHaveBeenCalledWith(
      '/:themes:configs',
      expect.not.objectContaining({ hash: {$in: ['a', 'b']} }),
    );
  });

  it('loads a theme from cache', async () => {
    // seed cached manifest + all configs
    await Promise.all([
      loader.getCache().set('manifest:####', ['a', 'b']),
      loader.getCache().set('config:a', configs[0]),
      loader.getCache().set('config:b', configs[1]),
    ]);

    const theme = await loader.loadThemeFromManifest();
    expect(theme).toEqual(configs);
  });

  it('loads a theme from cache and source', async () => {
    // seed cached manifest + partial configs
    await Promise.all([
      loader.getCache().set('manifest:####', ['a', 'b']),
      loader.getCache().set('config:a', configs[0]),
      // config b is not in the cache
    ]);

    jest.spyOn(swell, 'get').mockImplementation(async (url, data) => {
      switch (url) {
        case '/:themes:configs': {
          // Simulate the partial theme config request for config b
          return {
            results: [ configs[1] ],
          };
        }
        default: {
          throw new Error(`Unexpected url: ${url}`);
        }
      }
    });

    const theme = await loader.loadThemeFromManifest();

    expect(theme).toEqual(configs);

    expect(swell.get).toHaveBeenCalledWith(
      '/:themes:configs',
      expect.objectContaining({
        parent_id: 'themeid',
        branch_id: null,
        preview: { $ne: true },
        hash: { $in: ['b'] },
      }),
    );
  });
}); // describe: #loadThemeFromManifest


describe('#preloadTheme', () => {
  const version = {
    manifest: {
      'path1': 'a',
      'path2': 'b',
      'path3': 'c',
    },
    hash: 'versionhash',
  }

  const configs = [
    {
      file_data: 'foo',
      hash: 'a',
    },
    {
      file_data: 'bar',
      hash: 'b',
    },
  ];

  let swell;
  let loader;

  beforeEach(() => {
    swell = new Swell({
      headers: {},
      swellHeaders: {
        'public-key': 'publickey',
        'store-id': 'test',
        'theme-id': 'themeid',
        'theme-version-hash': '####',
        'theme-config-version': 4,
      },
      url: new URL('https://storefront.app'),
    }); 

    loader = new ThemeLoader(swell);

    // Reset the theme cache.
    loader.getCache().flushAll();
  });

  it('caches the manifest and configs', async () => {
    await loader.preloadTheme(version, configs);

    const cachedManifest = await loader.getCache().get('manifest:versionhash');
    expect(cachedManifest).toEqual(version.manifest);

    const cachedConfigs = await Promise.all([
      loader.getCache().get('config:a'),
      loader.getCache().get('config:b'),
    ]);
    expect(cachedConfigs).toEqual(configs);
  });
}); // describe: #preloadTheme
