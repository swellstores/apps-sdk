import qs from 'qs';
import { reduce } from 'lodash-es';

import {
  StorefrontResource,
  SwellStorefrontCollection,
  SwellStorefrontRecord,
} from '../resources';
import { ShopifyResource } from '../compatibility/shopify-objects/resource';
import { LANG_TO_COUNTRY_CODES } from '../constants';

import type {
  SwellData,
  SwellRecord,
  SwellThemeConfig,
  ThemeLayoutSectionGroupConfig,
  ThemePageSectionSchema,
  ThemePresetSchema,
  ThemeSection,
  ThemeSectionConfig,
  ThemeSectionGroup,
  ThemeSectionSchema,
  ThemeSettingsBlock,
} from 'types/swell';

export * from './md5';

/* export function dump(value: any, depth = 10) {
  console.log(util.inspect(value, { depth, colors: true }));
} */

export function themeConfigQuery(
  swellHeaders: Record<string, unknown>,
): Record<string, unknown> {
  return {
    parent_id: swellHeaders['theme-id'],
    branch_id: swellHeaders['theme-branch-id'] || null,
    preview:
      swellHeaders['deployment-mode'] === 'editor' ||
      swellHeaders['deployment-mode'] === 'preview'
        ? true
        : { $ne: true },
  };
}

function isSectionConfig(
  config: SwellThemeConfig,
  themeConfigs: Map<string, SwellThemeConfig>,
): boolean {
  if (!config.file_path.startsWith('theme/sections/')) {
    return false;
  }

  if (config.file_path.endsWith('.liquid')) {
    const hasJsonFile = themeConfigs.get(
      config.file_path.replace(/\.liquid$/, '.json'),
    );

    if (!hasJsonFile) {
      return true;
    }
  } else if (config.file_path.endsWith('.json')) {
    return true;
  }

  return false;
}

export async function getAllSections(
  themeConfigs: Map<string, SwellThemeConfig>,
  renderTemplateSchema: (
    config: SwellThemeConfig,
  ) => Promise<Partial<ThemeSectionSchema> | undefined>,
): Promise<ThemePageSectionSchema[]> {
  const allSections: ThemePageSectionSchema[] = [];

  for (const sectionConfig of themeConfigs.values()) {
    if (isSectionConfig(sectionConfig, themeConfigs)) {
      const schema = await renderTemplateSchema(sectionConfig);

      allSections.push({
        id: sectionConfig.name.split('.').pop(),
        ...schema,
        ...(schema && { presets: resolveSectionPresets(schema) }),
      });
    }
  }

  return allSections;
}

function resolveSectionPresets(
  schema?: ThemeSectionSchema,
): ThemePresetSchema[] {
  if (!Array.isArray(schema?.presets)) return [];

  return schema.presets.map((preset) => ({
    label: preset.label,
    settings: {
      ...schema.fields?.reduce((acc: any, field) => {
        if (field.id && field.default !== undefined) {
          acc[field.id] = field.default;
        }
        return acc;
      }, {}),
      ...(preset.settings || undefined),
    },
    blocks: preset.blocks?.map((block) => {
      const blockDef = schema.blocks?.find((b) => b.type === block.type);
      return blockDef
        ? {
            ...block,
            settings: {
              ...blockDef.fields.reduce((acc: any, field) => {
                if (field.id && field.default !== undefined) {
                  acc[field.id] = field.default;
                }
                return acc;
              }, {}),
              ...(block.settings || undefined),
            },
          }
        : block;
    }),
  }));
}

export async function getLayoutSectionGroups(
  allSections: Map<string, SwellThemeConfig>,
  renderTemplateSchema: (
    config: SwellThemeConfig,
  ) => Promise<Partial<ThemeSectionSchema> | undefined>,
): Promise<ThemeLayoutSectionGroupConfig[]> {
  const allSectionsList = Array.from(allSections.values());

  const sectionGroupConfigs = allSectionsList.filter(
    (config) =>
      config.file_path.startsWith('theme/sections/') &&
      config.file_path.endsWith('.json') &&
      // Section groups must not have a liquid file
      !allSections.has(config.file_path.replace(/\.json$/, '.liquid')),
  );

  const getSectionSchema = async (
    type: string,
  ): Promise<Partial<ThemeSectionSchema> | undefined> => {
    const config = allSectionsList.find((config) => {
      if (
        !config.file_path.endsWith(`/${type}.json`) &&
        !config.file_path.endsWith(`/${type}.liquid`)
      ) {
        return false;
      }

      if (config.file_path.endsWith('.liquid')) {
        const hasJsonFile = allSections.get(
          config.file_path.replace(/\.liquid$/, '.json'),
        );

        if (!hasJsonFile) {
          return true;
        }
      } else if (config.file_path.endsWith('.json')) {
        return true;
      }

      return false;
    });

    if (!config) {
      return undefined;
    }

    const schema = await renderTemplateSchema(config);
    return {
      ...schema,
      id: config.name.split('.').pop(),
    };
  };

  const layoutSectionGroups = [];
  for (const config of sectionGroupConfigs) {
    let sectionGroup;
    try {
      sectionGroup = JSON.parse(config.file_data);
      // Convert name to label if shopify format
      if (sectionGroup?.name) {
        sectionGroup.label = sectionGroup.name;
        delete sectionGroup.name;
      }
    } catch {
      // noop
    }

    // Must have a type property
    if (sectionGroup?.type) {
      const sectionConfigs = await getPageSections(
        sectionGroup,
        getSectionSchema,
      );
      layoutSectionGroups.push({
        ...sectionGroup,
        id: config.name.split('.').pop(),
        sectionConfigs,
      });
    }
  }

  return layoutSectionGroups;
}

export async function getPageSections(
  sectionGroup: ThemeSectionGroup | SwellRecord,
  getSchema: (type: string) => Promise<Partial<ThemeSectionSchema> | undefined>,
): Promise<ThemeSectionConfig[]> {
  const order =
    sectionGroup.order instanceof Array
      ? sectionGroup.order
      : Object.keys(sectionGroup.sections || {});

  const pageSections = [];
  for (const key of order) {
    const section: ThemeSection = sectionGroup.sections[key];

    if (!section) {
      continue;
    }

    const schema = (await getSchema(section.type)) || {
      id: section.type,
      tag: 'div',
      class: '',
      fields: [],
      blocks: [],
    };

    const id = sectionGroup.id ? `page__${sectionGroup.id}__${key}` : schema.id;

    const blockOrder =
      section.block_order instanceof Array
        ? section.block_order
        : Object.keys(section.blocks || {});

    const blocks: ThemeSettingsBlock[] = blockOrder
      .map((key: string) => section.blocks?.[key])
      .filter(Boolean) as ThemeSettingsBlock[];

    const settings = {
      section: {
        id,
        ...section,
        blocks,
      },
    };

    pageSections.push({
      id,
      section: { id, ...section },
      schema,
      settings,
      tag: schema.tag || 'div',
      class: schema.class,
    });
  }

  return pageSections as ThemeSectionConfig[];
}

export function isArray(value: any) {
  // be compatible with IE 8
  return String(value) === '[object Array]';
}

export function isObject(value: any) {
  const type = typeof value;
  return value !== null && (type === 'object' || type === 'function');
}

export function toBase64(inputString: string): string {
  const utf8Bytes = new TextEncoder().encode(inputString);
  let base64String = '';

  for (let i = 0; i < utf8Bytes.length; i += 3) {
    const chunk = Array.from(utf8Bytes.slice(i, i + 3));
    base64String += btoa(String.fromCharCode(...chunk));
  }

  return base64String;
}

export function arrayToObject(arr: Array<any>, key = 'id') {
  return reduce(
    arr,
    (obj: { [key: string]: any }, value) => {
      obj[value[key]] = value;
      return obj;
    },
    {},
  );
}

export function getCountryCodeFromLocale(locale: string): string {
  const split = locale.toUpperCase().split(/-|_/);
  const lang = split.shift() as string;
  const country = split.pop();
  let code = '';

  if (country) code = country;
  if (!country) code = LANG_TO_COUNTRY_CODES[lang.toLowerCase()] || '';

  return code.toLowerCase();
}

export function forEachKeyDeep(
  obj: any,
  fn: (key: string, value: any) => boolean | void,
) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  for (const key of Object.keys(obj)) {
    if (Object.hasOwn(obj, key)) {
      const result = fn(key, obj);

      if (result !== false) {
        const value = obj[key];

        if (typeof value === 'object' && value !== null) {
          forEachKeyDeep(value, fn);
        }
      }
    }
  }
}

export function findCircularReferences(value: any) {
  const references = new Set();

  forEachKeyDeep(value, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (references.has(value)) {
        return false;
      }
      references.add(value);
    }
  });

  return Array.from(references);
}

export function removeCircularReferences(value: any) {
  const references = new WeakSet();

  if (!value) {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (references.has(value)) {
          // Clone circular reference
          return JSON.parse(JSON.stringify(value));
        }
        references.add(value);
      }
      return value;
    }),
  );
}

export function dehydrateSwellRefsInStorefrontResources(obj: any) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  for (const key in obj) {
    if (key === '_swell') {
      obj[key] = undefined;
    } else {
      dehydrateSwellRefsInStorefrontResources(obj[key]);
    }
  }
}

function getType(value: any) {
  if (value === undefined) {
    return undefined;
  } else if (value instanceof SwellStorefrontCollection) {
    return 'SwellStorefrontCollection';
  } else if (value instanceof SwellStorefrontRecord) {
    return 'SwellStorefrontRecord';
  } else if (value instanceof ShopifyResource) {
    return 'ShopifyResource';
  } else if (value instanceof StorefrontResource) {
    return 'StorefrontResource';
  } else {
    return 'promise';
  }
}

export async function resolveAsyncResources(
  response: any,
  resolveStorefrontResources: boolean = true,
  resolveWithResourceMetadata: boolean = false,
) {
  let result = response;
  let nextResolveStorefrontResources = resolveStorefrontResources;

  try {
    if (response instanceof Promise) {
      nextResolveStorefrontResources = false;
      result = await response;
    }

    if (response instanceof StorefrontResource) {
      nextResolveStorefrontResources = false;
      result = await resolveAsyncResources(
        response.resolve(),
        resolveStorefrontResources,
        resolveWithResourceMetadata,
      );
    }

    if (result instanceof Array) {
      result = await Promise.all(
        result.map((item) =>
          resolveAsyncResources(
            item,
            resolveStorefrontResources,
            resolveWithResourceMetadata,
          ),
        ),
      );

      if (result.filter((item: any) => item !== undefined).length === 0) {
        return resolveStorefrontResources ? [] : undefined;
      }
    } else if (
      typeof result === 'object' &&
      result !== null &&
      !result._swell
    ) {
      const objectResult: any = {};
      for (const [key] of Object.entries(result)) {
        if (!resolveStorefrontResources) {
          if (
            result[key] instanceof Promise ||
            result[key] instanceof StorefrontResource ||
            result[key] instanceof ShopifyResource
          ) {
            objectResult[key] = {
              _type: getType(result[key]),
              ...(resolveWithResourceMetadata
                ? {
                    value: await resolveAsyncResources(
                      result[key],
                      nextResolveStorefrontResources,
                      resolveWithResourceMetadata,
                    ),
                  }
                : {}),
            };
            continue;
          }
        }

        if (result[key] instanceof StorefrontResource) {
          if (resolveWithResourceMetadata) {
            objectResult[key] = {
              _type: getType(result[key]),
              value: await resolveAsyncResources(
                result[key],
                nextResolveStorefrontResources,
                resolveWithResourceMetadata,
              ),
            };
            continue;
          }
        }

        objectResult[key] = await resolveAsyncResources(
          result[key],
          nextResolveStorefrontResources,
          resolveWithResourceMetadata,
        );
      }

      if (
        !resolveStorefrontResources &&
        Object.keys(objectResult).length === 0
      ) {
        return undefined;
      }

      return objectResult;
    }
  } catch (err: any) {
    console.error(err);
    return response;
  }

  return result;
}

export function stringifyQueryParams(queryParams: SwellData) {
  return qs.stringify(
    {
      ...queryParams,
      sections: undefined,
      section_id: undefined,
    },
    { encodeValuesOnly: true, arrayFormat: 'repeat' },
  );
}
