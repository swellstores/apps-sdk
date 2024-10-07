import type { Swell } from '@/api';
import {
  SwellStorefrontCollection,
  SwellStorefrontRecord,
  StorefrontResource,
} from '@/resources';
import type { SwellData } from 'types/swell';
import { categoryResourceData } from './categoryResourceData';

const STOREFRONT_URL =
  'http://test--c7f23c2d-4486-4025-8d4a-e545ca6091f1--local.swell.test:4001';
const RESOURCE = `CategoryResource`;

export class MockRecordResource extends SwellStorefrontRecord {
  constructor(swell: Swell, slug: string, query: SwellData = {}) {
    super(swell, '', slug, query, async function () {
      const data = await fetchResourceData(this.constructor.name, slug, query);
      return compileData(this.constructor.name, data, swell);
    });
  }
}

async function fetchResourceData(
  resource: string,
  slug: string,
  query: SwellData,
): Promise<any> {
  const params = new URLSearchParams({
    ...(slug && { slug }),
    ...(query && { query: JSON.stringify(query) }),
  });
  const response = await fetch(
    `${STOREFRONT_URL}/resources/${resource}.json/?${params.toString()}`,
  );
  return response.json();
}

function compileData(
  resource: string,
  data: any,
  swell: Swell,
  path = '',
): Record<string, any> {
  const compiled: Record<string, any> = {};

  for (const key in data) {
    const item = data[key];
    if (item?.type === 'SwellStorefrontCollection') {
      let updatedPath = path + `${path === '' ? '' : '/'}${key}`;
      compiled[key] = createCollection(resource, swell, updatedPath);
    } else if (item?.type === 'SwellStorefrontRecord') {
      let updatedPath = path + `${path === '' ? '' : '/'}${key}`;
      compiled[key] = createStorefrontRecord(resource, swell, updatedPath);
    } else if (item?.type === 'StorefrontResource') {
      let updatedPath = path + `${path === '' ? '' : '/'}${key}`;
      compiled[key] = createStorefrontResource(resource, swell, updatedPath);
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
): StorefrontResource {
  return new StorefrontResource(async function (
    this: SwellStorefrontRecord,
  ): Promise<any> {
    const data = await fetchResourceDataByPath(resource, path);
    return compileData(resource, data, swell, path);
  });
}

function createStorefrontRecord(
  resource: string,
  swell: Swell,
  path: string,
): SwellStorefrontRecord {
  return new SwellStorefrontRecord(swell, '', '', {}, async function (
    this: SwellStorefrontRecord,
  ): Promise<any> {
    const data = await fetchResourceDataByPath(resource, path);
    return compileData(resource, data, swell, path);
  });
}

function createCollection(
  resource: string,
  swell: Swell,
  path: string,
): SwellStorefrontCollection {
  return new SwellStorefrontCollection(swell, '', {}, async function (
    this: SwellStorefrontCollection,
  ): Promise<any> {
    const data = await fetchResourceDataByPath(resource, path);
    return compileData(resource, data, swell, path);
  });
}

async function fetchResourceDataByPath(
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
    `${STOREFRONT_URL}/resources/${resource}.json?${params}`,
  );
  const data = response.json();
  return data;
}
