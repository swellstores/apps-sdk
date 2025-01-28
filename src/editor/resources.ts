import type { Swell } from '@/api';
import {
  SwellStorefrontCollection,
  SwellStorefrontRecord,
  StorefrontResource,
  SwellStorefrontSingleton,
} from '@/resources';
import type { SwellCollection, SwellData, SwellRecord } from 'types/swell';

// use getCookie function which is set in swell.storefront
function getCookie(swell: Swell, name: string): string {
  const storefront = swell?.storefront as {
    options?: { getCookie?: (key: string) => string | undefined };
  };
  const getCookie = storefront?.options?.getCookie;
  if (typeof getCookie === 'function') {
    return getCookie(name) || '';
  }

  return '';
}

export class MockRecordResource extends SwellStorefrontRecord {
  constructor(swell: Swell, slug: string, query: SwellData = {}) {
    super(swell, '', slug, query, async function (): Promise<SwellRecord> {
      const data = await fetchResourceData<SwellRecord>(
        swell,
        this._resourceName,
        slug,
        query,
      );

      return compileData(this._resourceName, data, swell, '', slug, query);
    });
  }
}

export class MockRecordSingleton extends SwellStorefrontSingleton {
  constructor(swell: Swell, slug: string, query: SwellData = {}) {
    super(swell, '', async function (): Promise<SwellRecord> {
      const data = await fetchResourceData<SwellRecord>(
        swell,
        this._resourceName,
        slug,
        query,
      );

      const compiled = compileData<SwellRecord>(
        this._resourceName,
        data,
        swell,
        '',
        slug,
        query,
      );

      return compiled;
    });
  }
}

async function fetchResourceData<T>(
  swell: Swell,
  resource: string,
  slug?: string,
  query?: SwellData,
): Promise<T> {
  const params = new URLSearchParams({
    ...(slug && { slug }),
    ...(query && { query: JSON.stringify(query) }),
  });

  const search = params.size > 0 ? `?${params}` : '';
  const session = getCookie(swell, 'swell-session');
  const swellData = getCookie(swell, 'swell-data') || {};

  const response = await fetch(
    `${swell.storefront_url}/resources/${resource}.json/${search}`,
    {
      headers: {
        'X-Session': session,
        'Swell-Data': JSON.stringify(swellData),
      },
    },
  );

  return response.json() as T;
}

function compileData<T>(
  resource: string,
  data: object,
  swell: Swell,
  path = '',
  parent_slug: string,
  parent_query: SwellData,
): T {
  const compiled: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(data)) {
    const updatedPath = path + `${path === '' ? '' : '/'}${key}`;
    let handler;

    switch (item?._type) {
      case 'SwellStorefrontCollection':
        handler = createCollection;
        break;
      case 'SwellStorefrontRecord':
        handler = createStorefrontRecord;
        break;
      case 'createStorefrontResource':
        handler = createStorefrontResource;
        break;
      default:
        break;
    }

    compiled[key] = handler
      ? handler(resource, swell, updatedPath, parent_slug, parent_query)
      : item;
  }

  return compiled as T;
}

function createStorefrontResource(
  resource: string,
  swell: Swell,
  path: string,
  parent_slug: string,
  parent_query: SwellData,
): StorefrontResource {
  return new StorefrontResource(async function (): Promise<SwellData> {
    const data = await fetchResourceDataByPath<SwellRecord>(
      swell,
      resource,
      path,
      parent_slug,
      parent_query,
    );
    return compileData(resource, data, swell, path, parent_slug, parent_query);
  });
}

function createStorefrontRecord(
  resource: string,
  swell: Swell,
  path: string,
  parent_slug: string,
  parent_query: SwellData,
): SwellStorefrontRecord {
  const query = getResourceQuery(parent_slug, parent_query);

  return new SwellStorefrontRecord(
    swell,
    resource,
    path,
    query,
    async function (): Promise<SwellRecord> {
      const data = await fetchResourceDataByPath<SwellRecord>(
        swell,
        resource,
        path,
        parent_slug,
        parent_query,
      );

      return compileData<SwellRecord>(
        resource,
        data,
        swell,
        path,
        parent_slug,
        parent_query,
      );
    },
  );
}

function createCollection(
  resource: string,
  swell: Swell,
  path: string,
  parent_slug: string,
  parent_query: SwellData,
): SwellStorefrontCollection {
  const query = getResourceQuery(parent_slug, parent_query);

  return new SwellStorefrontCollection(
    swell,
    resource,
    query,
    async function (): Promise<SwellCollection<SwellRecord>> {
      const data = await fetchResourceDataByPath<SwellRecord>(
        swell,
        resource,
        path,
        parent_slug,
        parent_query,
      );

      return compileData<SwellCollection<SwellRecord>>(
        resource,
        data,
        swell,
        path,
        parent_slug,
        parent_query,
      );
    },
  );
}

async function fetchResourceDataByPath<T>(
  swell: Swell,
  resource: string,
  path: string,
  slug?: string,
  query?: SwellData,
): Promise<T> {
  const params = new URLSearchParams({
    path,
    ...(slug && { slug }),
    ...(query && { query: JSON.stringify(query) }),
  });

  const search = params.size > 0 ? `?${params}` : '';
  const session = getCookie(swell, 'swell-session');
  const swellData = getCookie(swell, 'swell-data') || {};

  const response = await fetch(
    `${swell.storefront_url}/resources/${resource}.json${search}`,
    {
      headers: {
        'X-Session': session,
        'Swell-Data': JSON.stringify(swellData),
      },
    },
  );

  return response.json() as T;
}

function getResourceQuery(slug?: string, query?: SwellData): SwellData {
  return {
    ...(slug && { slug }),
    ...query,
  };
}
