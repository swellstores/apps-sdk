import { Swell } from '../api';
import { ThemeLoader } from './theme-loader';

import type { SwellThemeConfig } from 'types/swell';

const CONFIG = {
  id: 'config-1',
  name: 'index.json',
  type: 'theme',
  file: { content_type: 'application/json' },
  file_path: 'theme/templates/index.json',
  hash: 'hash-1',
} as unknown as SwellThemeConfig;

function createLoader(configVersion: string, deploymentMode = 'live') {
  const swell = new Swell({
    serverHeaders: {
      'swell-store-id': 'test-store',
      'swell-public-key': 'publickey',
      'swell-deployment-mode': deploymentMode,
      'swell-theme-id': 'theme-1',
      'swell-theme-config-version': configVersion,
    },
    url: new URL('https://storefront.app'),
  });

  const loader = new ThemeLoader(swell);

  // A private method: the config list lookup is what this suite tests
  const fetchConfigMetadata = () =>
    (
      loader as unknown as {
        fetchConfigMetadata(): Promise<SwellThemeConfig[]>;
      }
    ).fetchConfigMetadata();

  return { swell, fetchConfigMetadata };
}

describe('ThemeLoader', () => {
  beforeEach(() => {
    // A fresh memory cache per test, as the cache is shared by all loaders
    Reflect.set(ThemeLoader, 'cache', null);
  });

  describe('fetchConfigMetadata', () => {
    it('does not cache an empty config list', async () => {
      const { swell, fetchConfigMetadata } = createLoader('live-1');
      const get = jest.spyOn(swell, 'get').mockResolvedValue({ results: [] });

      expect(await fetchConfigMetadata()).toEqual([]);
      expect(await fetchConfigMetadata()).toEqual([]);

      expect(get).toHaveBeenCalledTimes(2);
    });

    it('caches a config list for the same config version', async () => {
      const { swell, fetchConfigMetadata } = createLoader('live-1');
      const get = jest
        .spyOn(swell, 'get')
        .mockResolvedValue({ results: [CONFIG] });

      expect(await fetchConfigMetadata()).toEqual([CONFIG]);
      expect(await fetchConfigMetadata()).toEqual([CONFIG]);

      expect(get).toHaveBeenCalledTimes(1);
    });

    it('reads the list again when the config version changes', async () => {
      const before = createLoader('live-1');
      const getBefore = jest
        .spyOn(before.swell, 'get')
        .mockResolvedValue({ results: [CONFIG] });

      await before.fetchConfigMetadata();
      expect(getBefore).toHaveBeenCalledTimes(1);

      // A publish finished: the gateway now sends the next config version
      const after = createLoader('live-2');
      const updated = { ...CONFIG, hash: 'hash-2' };
      const getAfter = jest
        .spyOn(after.swell, 'get')
        .mockResolvedValue({ results: [updated] });

      expect(await after.fetchConfigMetadata()).toEqual([updated]);
      expect(getAfter).toHaveBeenCalledTimes(1);
    });

    it.each(['preview', 'editor'])(
      'keeps the %s list across config versions',
      async (mode) => {
        const before = createLoader('preview-1', mode);
        jest
          .spyOn(before.swell, 'get')
          .mockResolvedValue({ results: [CONFIG] });

        await before.fetchConfigMetadata();

        // An edit raises the draft's config version: its key stays the same
        const after = createLoader('preview-2', mode);
        const getAfter = jest
          .spyOn(after.swell, 'get')
          .mockResolvedValue({ results: [CONFIG] });

        expect(await after.fetchConfigMetadata()).toEqual([CONFIG]);
        expect(getAfter).not.toHaveBeenCalled();
      },
    );
  });
});
