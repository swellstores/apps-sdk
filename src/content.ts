import {
  type Swell,
  SwellStorefrontCollection,
  SwellStorefrontRecord,
} from './api';

import type { SwellCollection, SwellData } from 'types/swell';

export function getContentModel(
  swell: Swell,
  name: string,
): Promise<SwellData | undefined> {
  return swell.getCachedResource(`content-model-${name}`, [], () =>
    swell.get('/:content/{name}', {
      name,
      public: true,
      'storefront.enabled': true,
    }),
  );
}

export function getContentList(
  swell: Swell,
  type: string,
  query?: SwellData,
): SwellStorefrontCollection<SwellCollection<SwellData>> {
  return new SwellStorefrontCollection(swell, `content/${type}`, query);
}

export function getContentEntry(
  swell: Swell,
  type: string,
  id: string,
  query?: SwellData,
): SwellStorefrontRecord<SwellData> {
  return new SwellStorefrontRecord(swell, `content/${type}`, id, query);
}

export function getPage(
  swell: Swell,
  id: string,
  query?: object,
): SwellStorefrontRecord<SwellData> {
  return getContentEntry(swell, 'pages', id, query);
}

export function getBlogs(
  swell: Swell,
  query?: SwellData,
): SwellStorefrontCollection<SwellCollection<SwellData>> {
  return getContentList(swell, 'blogs', query);
}

export function getBlog(
  swell: Swell,
  id: string,
  query?: object,
): SwellStorefrontRecord<SwellData> {
  return getContentEntry(swell, 'blogs', id, query);
}
