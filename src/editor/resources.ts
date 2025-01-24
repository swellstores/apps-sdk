import type { Swell } from '@/api';
import {
  SwellStorefrontCollection,
  SwellStorefrontRecord,
  StorefrontResource,
  SwellStorefrontSingleton,
} from '@/resources';
import type { SwellData } from 'types/swell';

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
    super(
      swell,
      '',
      slug,
      query,
      async function (this: { _resourceName: string }): Promise<any> {
        const data = await fetchResourceData(
          swell,
          this._resourceName,
          slug,
          query,
        );
        return compileData(this._resourceName, data, swell, '', slug, query);
      },
    );
  }
}

export class MockRecordSingleton extends SwellStorefrontSingleton {
  constructor(swell: Swell, slug: string, query: SwellData = {}) {
    super(
      swell,
      '',
      async function (this: { _resourceName: string }): Promise<any> {
        const data = await fetchResourceData(
          swell,
          this._resourceName,
          slug,
          query,
        );
        const compiled = compileData(
          this._resourceName,
          data,
          swell,
          '',
          slug,
          query,
        );

        return compiled;
      },
    );
  }
}

async function fetchResourceData(
  swell: Swell,
  resource: string,
  slug?: string,
  query?: SwellData,
): Promise<any> {
  const params = new URLSearchParams({
    ...(slug && { slug }),
    ...(query && { query: JSON.stringify(query) }),
  });

  const session = getCookie(swell, 'swell-session');
  const swellData = getCookie(swell, 'swell-data');

  const response = await fetch(
    `${swell.storefront_url}/resources/${resource}.json/?${params.toString()}`,
    {
      headers: {
        'X-Session': session,
        'Swell-Data': JSON.stringify(swellData),
      },
    },
  );
  return response.json();
}

function compileData(
  resource: string,
  data: any,
  swell: Swell,
  path = '',
  parent_slug: string,
  parent_query: SwellData,
): Record<string, any> {
  const compiled: Record<string, any> = {};

  for (const key in data) {
    const item = data[key];
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

  return compiled;
}

function createStorefrontResource(
  resource: string,
  swell: Swell,
  path: string,
  parent_slug: string,
  parent_query: SwellData,
): StorefrontResource {
  return new StorefrontResource(async function (
    this: SwellStorefrontRecord,
  ): Promise<any> {
    const data = await fetchResourceDataByPath(
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
  return new SwellStorefrontRecord(swell, resource, path, {}, async function (
    this: SwellStorefrontRecord,
  ): Promise<any> {
    const data = await fetchResourceDataByPath(
      swell,
      resource,
      path,
      parent_slug,
      parent_query,
    );
    return compileData(resource, data, swell, path, parent_slug, parent_query);
  });
}

function createCollection(
  resource: string,
  swell: Swell,
  path: string,
  parent_slug: string,
  parent_query: SwellData,
): SwellStorefrontCollection {
  return new SwellStorefrontCollection(swell, resource, {}, async function (
    this: SwellStorefrontCollection,
  ): Promise<any> {
    const data = await fetchResourceDataByPath(
      swell,
      resource,
      path,
      parent_slug,
      parent_query,
    );
    return compileData(resource, data, swell, path, parent_slug, parent_query);
  });
}

async function fetchResourceDataByPath(
  swell: Swell,
  resource: string,
  path: string,
  slug?: string,
  query?: SwellData,
): Promise<any> {
  const params = new URLSearchParams({
    path,
    ...(slug && { slug }),
    ...(query && { query: JSON.stringify(query) }),
  });

  const session = getCookie(swell, 'swell-session');
  const swellData = getCookie(swell, 'swell-data');

  const response = await fetch(
    `${swell.storefront_url}/resources/${resource}.json?${params}`,
    {
      headers: {
        'X-Session': session,
        'Swell-Data': JSON.stringify(swellData),
      },
    },
  );
  const data = response.json();
  return data;
}
