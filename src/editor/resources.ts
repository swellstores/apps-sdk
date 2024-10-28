import type { Swell } from '@/api';
import {
  SwellStorefrontCollection,
  SwellStorefrontRecord,
  StorefrontResource,
  SwellStorefrontSingleton,
} from '@/resources';
import type { SwellData } from 'types/swell';

export class MockRecordResource extends SwellStorefrontRecord {
  constructor(swell: Swell, slug: string, query: SwellData = {}) {
    super(swell, '', slug, query, async function (this: any): Promise<any> {
      const data = await fetchResourceData(
        swell,
        this.constructor.name,
        slug,
        query,
      );
      return compileData(this.constructor.name, data, swell, '', slug, query);
    });
  }
}

export class MockRecordSingleton extends SwellStorefrontSingleton {
  constructor(swell: Swell, slug: string, query: SwellData = {}) {
    super(swell, '', async function (this: any): Promise<any> {
      const data = await fetchResourceData(
        swell,
        this.constructor.name,
        slug,
        query,
      );
      const compiled = compileData(
        this.constructor.name,
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
  const response = await fetch(
    `${swell.storefront_url}/resources/${resource}.json/?${params.toString()}`,
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
  const response = await fetch(
    `${swell.storefront_url}/resources/${resource}.json?${params}`,
  );
  const data = response.json();
  return data;
}
