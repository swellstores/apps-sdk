import type { Swell } from '@/api';
import {
  SwellStorefrontCollection,
  SwellStorefrontRecord,
  StorefrontResource,
  SwellStorefrontSingleton,
} from '@/resources';
import type { SwellData } from 'types/swell';

const STOREFRONT_URL =
  'http://test--c7f23c2d-4486-4025-8d4a-e545ca6091f1--local.swell.test:4001';

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
      return compileData(this.constructor.name, data, swell, '', slug, query);
    });
  }
}

async function fetchResourceData(
  swell: Swell,
  resource: string,
  slug: string,
  query: SwellData,
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
    if (item?._type === 'SwellStorefrontCollection') {
      let updatedPath = path + `${path === '' ? '' : '/'}${key}`;
      compiled[key] = createCollection(
        resource,
        swell,
        updatedPath,
        parent_slug,
        parent_query,
      );
    } else if (item?._type === 'SwellStorefrontRecord') {
      let updatedPath = path + `${path === '' ? '' : '/'}${key}`;
      compiled[key] = createStorefrontRecord(
        resource,
        swell,
        updatedPath,
        parent_slug,
        parent_query,
      );
    } else if (item?._type === 'StorefrontResource') {
      let updatedPath = path + `${path === '' ? '' : '/'}${key}`;
      compiled[key] = createStorefrontResource(
        resource,
        swell,
        updatedPath,
        parent_slug,
        parent_query,
      );
    } else {
      compiled[key] = item;
    }
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
  return new SwellStorefrontRecord(swell, '', '', {}, async function (
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
  return new SwellStorefrontCollection(swell, '', {}, async function (
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
    ...(path && { path }),
    ...(slug && { slug }),
    ...(query && { query: JSON.stringify(query) }),
  });
  const response = await fetch(
    `${swell.storefront_url}/resources/${resource}.json?${params}`,
  );
  const data = response.json();
  return data;
}
