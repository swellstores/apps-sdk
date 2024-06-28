import reduce from 'lodash/reduce';
import { StorefrontResource } from './resources';
import { ShopifyResource } from './compatibility/shopify-objects/resource';
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
      );
    }

    if (result instanceof ShopifyResource) {
      //nextResolveStorefrontResources = false;
      if (!resolveStorefrontResources) {
        //console.log('shopify resource stop here', result);
      }
    }

    if (result instanceof Array) {
      result = await Promise.all(
        result.map((item) =>
          resolveAsyncResources(item, resolveStorefrontResources),
        ),
      );

      if (result.filter((item: any) => item !== undefined).length === 0) {
        return undefined;
      }
    } else if (typeof result === 'object' && result !== null && !result._swell) {
      const objectResult: any = {};
      for (const [key] of Object.entries(result)) {
        if (!resolveStorefrontResources) {
          if (
            result[key] instanceof Promise ||
            result[key] instanceof StorefrontResource ||
            result instanceof ShopifyResource
          ) {
            continue;
          }
        }

        objectResult[key] = await resolveAsyncResources(
          result[key],
          nextResolveStorefrontResources,
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
    return {};
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

//  Formatted version of a popular md5 implementation
//  Original copyright (c) Paul Johnston & Greg Holt.
export function md5(inputString: string) {
  var hc = '0123456789abcdef';
  function rh(n) {
    var j,
      s = '';
    for (j = 0; j <= 3; j++)
      s +=
        hc.charAt((n >> (j * 8 + 4)) & 0x0f) + hc.charAt((n >> (j * 8)) & 0x0f);
    return s;
  }
  function ad(x, y) {
    var l = (x & 0xffff) + (y & 0xffff);
    var m = (x >> 16) + (y >> 16) + (l >> 16);
    return (m << 16) | (l & 0xffff);
  }
  function rl(n, c) {
    return (n << c) | (n >>> (32 - c));
  }
  function cm(q, a, b, x, s, t) {
    return ad(rl(ad(ad(a, q), ad(x, t)), s), b);
  }
  function ff(a, b, c, d, x, s, t) {
    return cm((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a, b, c, d, x, s, t) {
    return cm((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a, b, c, d, x, s, t) {
    return cm(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a, b, c, d, x, s, t) {
    return cm(c ^ (b | ~d), a, b, x, s, t);
  }
  function sb(x) {
    var i;
    var nblk = ((x.length + 8) >> 6) + 1;
    var blks = new Array(nblk * 16);
    for (i = 0; i < nblk * 16; i++) blks[i] = 0;
    for (i = 0; i < x.length; i++)
      blks[i >> 2] |= x.charCodeAt(i) << ((i % 4) * 8);
    blks[i >> 2] |= 0x80 << ((i % 4) * 8);
    blks[nblk * 16 - 2] = x.length * 8;
    return blks;
  }
  var i,
    x = sb('' + inputString),
    a = 1732584193,
    b = -271733879,
    c = -1732584194,
    d = 271733878,
    olda,
    oldb,
    oldc,
    oldd;
  for (i = 0; i < x.length; i += 16) {
    olda = a;
    oldb = b;
    oldc = c;
    oldd = d;
    a = ff(a, b, c, d, x[i + 0], 7, -680876936);
    d = ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10], 17, -42063);
    b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = gg(b, c, d, a, x[i + 0], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5], 4, -378558);
    d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = hh(d, a, b, c, x[i + 0], 11, -358537222);
    c = hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = ii(a, b, c, d, x[i + 0], 6, -198630844);
    d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = ad(a, olda);
    b = ad(b, oldb);
    c = ad(c, oldc);
    d = ad(d, oldd);
  }
  return rh(a) + rh(b) + rh(c) + rh(d);
}