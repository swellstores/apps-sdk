import qs from 'qs';
import { cloneDeep, reduce } from 'lodash-es';
import JSON5 from 'json5';

import {
  StorefrontResource,
  SwellStorefrontCollection,
  SwellStorefrontRecord,
} from '../resources';
import { ShopifyResource } from '../compatibility/shopify-objects/resource';
import { LANG_TO_COUNTRY_CODES } from '../constants';

import type {
  SwellData,
  SwellLocale,
  SwellThemeConfig,
  ThemeLayoutSectionGroupConfig,
  ThemePageSectionSchema,
  ThemePresetSchema,
  ThemeSection,
  ThemeSectionConfig,
  ThemeSectionGroup,
  ThemeSectionSchema,
  ThemeSettings,
  ThemeSettingsBlock,
} from 'types/swell';
import { isLikePromise } from '@/liquid/utils';
import { toSchemaFieldId } from '@/easyblocks/utils';

export * from './md5';

/* export function dump(value: any, depth = 10) {
  console.log(util.inspect(value, { depth, colors: true }));
} */

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
  ) => Promise<ThemeSectionSchema | undefined>,
): Promise<ThemePageSectionSchema[]> {
  const allSections: ThemePageSectionSchema[] = [];

  for (const sectionConfig of themeConfigs.values()) {
    if (isSectionConfig(sectionConfig, themeConfigs)) {
      const schema = await renderTemplateSchema(sectionConfig);

      if (schema) {
        allSections.push({
          ...schema,
          id:
            String(sectionConfig.name || '')
              .split('.')
              .pop() ?? '',
          ...(schema && { presets: resolveSectionPresets(schema) }),
        });
      }
    }
  }

  return allSections;
}

function resolveSectionPresets(
  schema?: ThemeSectionSchema,
): ThemePresetSchema[] {
  if (!Array.isArray(schema?.presets)) return [];

  return schema.presets.map<ThemePresetSchema>((preset) => ({
    label: preset.label,
    settings: {
      ...schema.fields?.reduce<ThemeSettings>((acc, field) => {
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
              ...blockDef.fields.reduce<ThemeSettings>((acc, field) => {
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
      id: String(config.name || '')
        .split('.')
        .pop(),
    };
  };

  const layoutSectionGroups: ThemeLayoutSectionGroupConfig[] = [];
  for (const config of sectionGroupConfigs) {
    let sectionGroup;
    try {
      sectionGroup = JSON5.parse<ThemeSectionGroup>(config.file_data);
      // Convert name to label if shopify format
      if (sectionGroup?.name) {
        sectionGroup.label = sectionGroup.name;
        delete sectionGroup.name;
      }
    } catch (err) {
      // noop
      console.warn(err);
    }

    // Must have a type property
    if (sectionGroup?.type) {
      const sectionConfigs = await getPageSections(
        sectionGroup,
        getSectionSchema,
      );

      layoutSectionGroups.push({
        ...sectionGroup,
        id: String(config.name || '')
          .split('.')
          .pop(),
        sectionConfigs,
      } as ThemeLayoutSectionGroupConfig);
    }
  }

  return layoutSectionGroups;
}

export async function getPageSections(
  sectionGroup: ThemeSectionGroup,
  getSchema: (type: string) => Promise<Partial<ThemeSectionSchema> | undefined>,
): Promise<ThemeSectionConfig[]> {
  const order = Array.isArray(sectionGroup?.order)
    ? sectionGroup.order
    : Object.keys(sectionGroup?.sections || {});

  const pageSections: ThemeSectionConfig[] = [];
  for (const key of order) {
    const section: ThemeSection = sectionGroup.sections[key];

    if (!section) {
      continue;
    }

    const schema: ThemeSectionSchema = ((await getSchema(
      section.type,
    )) as ThemeSectionSchema) || {
      id: section.type,
      label: section.type,
      tag: 'div',
      class: '',
      fields: [],
      blocks: [],
    };

    const id = sectionGroup.id ? `page__${sectionGroup.id}__${key}` : schema.id;

    const blockOrder = Array.isArray(section.block_order)
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

  return pageSections;
}

export function isArray<T>(value: unknown): value is Array<T> {
  // be compatible with IE 8
  return String(value) === '[object Array]';
}

export function isObject(value: unknown): value is Record<string, unknown> {
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

export function arrayToObject<
  // T extends Record<keyof T | K, unknown>,
  T extends { [I in keyof T | K]?: T[I] },
  K extends string = 'id',
>(arr: T[], key: K = 'id' as K): Record<string, T | undefined> {
  return reduce(
    arr,
    (obj, value) => {
      obj[String(value[key])] = value;
      return obj;
    },
    {} as Record<string, T>,
  );
}

export function getCountryCodeFromLocale(locale: string): string {
  const split = locale.split(/-|_/);
  const country = split.pop()?.toUpperCase();
  const lang = split.join('-');

  const code = country ? country : LANG_TO_COUNTRY_CODES[lang] || '';

  return code.toLowerCase();
}

export function isLikeSwellLocale(value: unknown): value is SwellLocale {
  return (
    isObject(value) &&
    Object.hasOwn(value, 'code') &&
    Object.hasOwn(value, 'name') &&
    Object.hasOwn(value, 'fallback')
  );
}

export function forEachKeyDeep(
  obj: Record<string, unknown>,
  fn: (key: string, value: unknown) => boolean | void,
): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const result = fn(key, obj);

    if (result !== false) {
      if (typeof value === 'object' && value !== null) {
        forEachKeyDeep(value as Record<string, unknown>, fn);
      }
    }
  }
}

export function findCircularReferences(value: object): unknown[] {
  const references = new Set();

  forEachKeyDeep(value as Record<string, unknown>, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (references.has(value)) {
        return false;
      }

      references.add(value);
    }

    return true;
  });

  return Array.from(references);
}

export function removeCircularReferences(value: object): object {
  if (!value) {
    return value;
  }

  const references = new WeakSet();

  return JSON.parse(
    JSON.stringify(value, (_key, value: unknown) => {
      if (typeof value === 'object' && value !== null) {
        if (references.has(value)) {
          // Clone circular reference
          return JSON.parse(JSON.stringify(value)) as object;
        }
        references.add(value);
      }
      return value;
    }),
  ) as object;
}

export function dehydrateSwellRefsInStorefrontResources(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === '_swell' && '_swell' in obj) {
      obj[key] = undefined;
    } else {
      dehydrateSwellRefsInStorefrontResources(value);
    }
  }
}

function getStorefrontResourceType(value: unknown) {
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
  response: unknown,
  resolveStorefrontResources: boolean = true,
  resolveWithResourceMetadata: boolean = false,
): Promise<unknown> {
  let result = response;
  let nextResolveStorefrontResources = resolveStorefrontResources;

  try {
    if (isLikePromise(response)) {
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

    if (Array.isArray(result)) {
      const array = await Promise.all(
        result.map((item) =>
          resolveAsyncResources(
            item,
            resolveStorefrontResources,
            resolveWithResourceMetadata,
          ),
        ),
      );

      result = array;

      if (!array.some((item) => item !== undefined)) {
        return resolveStorefrontResources ? [] : undefined;
      }
    } else if (
      typeof result === 'object' &&
      result !== null &&
      (!('_swell' in result) || !result._swell)
    ) {
      const objectResult: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(result)) {
        if (!resolveStorefrontResources) {
          if (
            isLikePromise(value) ||
            value instanceof StorefrontResource ||
            value instanceof ShopifyResource
          ) {
            objectResult[key] = {
              _type: getStorefrontResourceType(value),
              ...(resolveWithResourceMetadata
                ? {
                    value: await resolveAsyncResources(
                      value,
                      nextResolveStorefrontResources,
                      resolveWithResourceMetadata,
                    ),
                  }
                : undefined),
            };
            continue;
          }
        }

        if (value instanceof StorefrontResource) {
          if (resolveWithResourceMetadata) {
            objectResult[key] = {
              _type: getStorefrontResourceType(value),
              value: await resolveAsyncResources(
                value,
                nextResolveStorefrontResources,
                resolveWithResourceMetadata,
              ),
            };
            continue;
          }
        }

        objectResult[key] = await resolveAsyncResources(
          value,
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
  } catch (err) {
    console.error(err);
    return response;
  }

  return result;
}

export function stringifyQueryParams(queryParams: SwellData): string {
  return qs.stringify(
    {
      ...queryParams,
      sections: undefined,
      section_id: undefined,
    },
    { encodeValuesOnly: true, arrayFormat: 'repeat' },
  );
}

export function scopeCustomCSS(
  custom_css: string | string[],
  sectionID: string,
): string {
  custom_css = Array.isArray(custom_css) ? custom_css.join(' ') : custom_css;

  const cssRules = custom_css.split('}');

  const scopedCSS = cssRules
    .map((rule) => {
      const [selectors, properties] = rule.split('{');
      if (!selectors || !properties) return ''; // Skip invalid rules
      const scopedSelectors = selectors
        .split(',')
        .map((selector) => `#${sectionID} ${selector.trim()}`)
        .join(', ');

      return `${scopedSelectors} {${properties}}`;
    })
    .join(' ');

  return scopedCSS;
}

export function extractSettingsFromForm(
  form: Record<string, { value: unknown } | undefined>,
  currentSettings: Record<string, unknown>,
): ThemeSettings {
  return Object.entries(form).reduce<ThemeSettings>(
    (acc, [formKey, formValue]) => {
      if (formValue?.value !== null && formValue?.value !== undefined) {
        acc[toSchemaFieldId(formKey)] = formValue?.value;
      }
      return acc;
    },
    cloneDeep(currentSettings),
  );
}

export const SECTION_GROUP_CONTENT = 'ContentSections';

export function getSectionGroupProp(sectionId: string): string {
  return `SectionGroup_${sectionId}`;
}
