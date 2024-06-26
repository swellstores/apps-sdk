import reduce from 'lodash/reduce';
import { StorefrontResource } from './resources';
import { LANG_TO_COUNTRY_CODES } from './constants';
import qs from 'qs';

/* export function dump(value: any, depth = 10) {
  console.log(util.inspect(value, { depth, colors: true }));
} */

export function themeConfigQuery(swellHeaders: { [key: string]: any }): {
  [key: string]: any;
} {
  return {
    parent_id: swellHeaders['theme-id'],
    branch_id: swellHeaders['theme-branch-id'] || null,
    preview:
      swellHeaders['deployment-mode'] === 'preview' ? true : { $ne: true },
  };
}

export async function getAllSections(
  themeConfigs: SwellCollection,
  renderTemplateSchema: (config: any) => Promise<any>,
): Promise<ThemePageSectionSchema[]> {
  if (!themeConfigs?.results) return [];

  const sectionConfigs = themeConfigs.results.filter((config: SwellRecord) => {
    if (!config.file_path?.startsWith('theme/sections/')) return false;
    const isLiquidFile = config.file_path.endsWith('.liquid');
    const isJsonFile = config.file_path.endsWith('.json');

    if (isLiquidFile) {
      const hasJsonFile = themeConfigs.results.find(
        (c: any) =>
          c.file_path === config.file_path.replace(/\.liquid$/, '.json'),
      );
      if (!hasJsonFile) {
        return true;
      }
    } else if (isJsonFile) {
      return true;
    }
  });

  const allSections = [];
  for (const sectionConfig of sectionConfigs) {
    const schema = await renderTemplateSchema(sectionConfig);
    allSections.push({
      id: sectionConfig.name.split('.').pop(),
      ...schema,
      presets: resolveSectionPresets(schema),
    });
  }

  return allSections;
}

export function resolveSectionPresets(schema: ThemeSectionSchema) {
  if (!Array.isArray(schema.presets)) return [];

  return schema.presets.map((preset) => ({
    settings: {
      ...schema.fields.reduce((acc: any, field) => {
        if (field.id && field.default !== undefined) {
          return {
            ...acc,
            [field.id]: field.default,
          };
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
                  return {
                    ...acc,
                    [field.id]: field.default,
                  };
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
  allSections: SwellCollection,
  renderTemplateSchema: (config: any) => Promise<any>,
): Promise<ThemeLayoutSectionGroupConfig[]> {
  if (!allSections?.results) return [];

  const sectionGroupConfigs = allSections.results.filter(
    (config: SwellRecord) =>
      config.file_path?.startsWith('theme/sections/') &&
      config.file_path?.endsWith('.json') &&
      // Section groups must not have a liquid file
      !allSections.results.find(
        (c: SwellRecord) =>
          c.file_path === config.file_path.replace(/\.json$/, '.liquid'),
      ),
  );

  const getSectionSchema = async (
    type: string,
  ): Promise<ThemeSectionSchema | undefined> => {
    const config = allSections.results.find((config: SwellRecord) => {
      if (
        !config.file_path?.endsWith(`/${type}.json`) &&
        !config.file_path?.endsWith(`/${type}.liquid`)
      ) {
        return false;
      }

      const isLiquidFile = config.file_path.endsWith('.liquid');
      const isJsonFile = config.file_path.endsWith('.json');

      if (isLiquidFile) {
        const hasJsonFile = allSections.results.find(
          (c: any) =>
            c.file_path === config.file_path.replace(/\.liquid$/, '.json'),
        );
        if (!hasJsonFile) {
          return true;
        }
      } else if (isJsonFile) {
        return true;
      }
    });

    const schema = await renderTemplateSchema(config);
    return {
      ...schema,
      id: config?.name.split('.').pop(),
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
  getSchema: (type: string) => Promise<ThemeSectionSchema | undefined>,
): Promise<ThemeSectionConfig[]> {
  const order =
    sectionGroup.order instanceof Array
      ? sectionGroup.order
      : Object.keys(sectionGroup.sections || {});

  const pageSections = [];
  for (const key of order) {
    const section: ThemeSection = sectionGroup.sections[key];

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
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
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
  let references: any[] = [];

  forEachKeyDeep(value, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (references.includes(value)) {
        return false;
      }
      references.push(value);
    }
  });

  return references;
}

export function removeCircularReferences(value: any) {
  let references: any[] = [];

  if (!value) {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (references.includes(value)) {
          // Clone circular reference
          return JSON.parse(JSON.stringify(value));
        }
        references.push(value);
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

export async function resolveAsyncResources(
  response: any,
  resolveStorefrontResources: boolean = true,
) {
  let result = response;
  let nextResolveStorefrontResources = resolveStorefrontResources;

  if (response instanceof Promise) {
    result = await response;
  }

  if (typeof response?.resolve === 'function') {
    // Only resolve one level of storefront resources by default
    if (response instanceof StorefrontResource && resolveStorefrontResources) {
      nextResolveStorefrontResources = false;
    }
    result = await response.resolve();
  }

  if (result instanceof Array) {
    result = await Promise.all(
      result.map((item) =>
        resolveAsyncResources(item, nextResolveStorefrontResources),
      ),
    );
  } else if (
    typeof result === 'object' &&
    result !== null &&
    !(result instanceof StorefrontResource)
  ) {
    result = { ...result };
    for (const [key] of Object.entries(result)) {
      result[key] = await resolveAsyncResources(
        result[key],
        nextResolveStorefrontResources,
      );
    }
  }

  return result;
}

export function stringifyQueryParams(queryParams: SwellData) {
  return (
    qs
      .stringify({
        ...queryParams,
        sections: undefined,
        section_id: undefined,
      })
      // Use actual brackets
      .replace(/%5B/g, '[')
      .replace(/%5D/g, ']')
  );
}