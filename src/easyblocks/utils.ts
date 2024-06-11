import get from 'lodash/get';
import reduce from 'lodash/reduce';
import { Swell } from '../api';
import { Backend, Document, UserDefinedTemplate } from '@easyblocks/core';
import { themeConfigQuery } from '../utils';

export async function getThemeConfig(
  swell: Swell,
  themePath: string,
): Promise<SwellRecord | null> {
  if (!swell.swellHeaders['theme-id']) {
    return null;
  }

  const config = await swell.getCached(
    'editor-theme-config',
    [themePath],
    async () => {
      return await swell.get('/:themes:configs/:last', {
        ...themeConfigQuery(swell.swellHeaders),
        file_path: `theme/${themePath}.json`,
        fields: 'type, name, file, file_path, file_data',
        include: {
          file_data: {
            url: '/:themes:configs/{id}/file/data',
            conditions: {
              type: 'theme',
            },
          },
        },
      });
    },
  );

  try {
    return JSON.parse(config.file_data);
  } catch {
    return null;
  }
}

export async function getEditorLanguageConfig(swell: Swell) {
  let editorLang = await getThemeConfig(swell, `config/language-editor`);

  // Fallback to shopify theme locales
  // TODO: put this logic in ShopifyCompatibility class
  if (!editorLang) {
    const storefrontSettings = await swell.getStorefrontSettings();
    const localeCode = storefrontSettings?.locale || 'en-US';
    editorLang = await getThemeConfig(swell, `locales/${localeCode}.schema`);
    if (!editorLang) {
      const localeBaseCode = (localeCode as string).split('-')[0];
      editorLang = await getThemeConfig(
        swell,
        `locales/${localeBaseCode}.schema`,
      );
    }
  }

  return editorLang;
}

export function renderLanguage(lang: any, key: string): string {
  if (key === undefined) {
    return '';
  }

  const localeCode = /*String(this.globals?.store?.locale || "") ||*/ 'en-US';
  const keyParts = key?.split('.') || [];
  const keyName = keyParts.pop() || '';
  const keyPath = keyParts.join('.');
  const langObject = get(lang, keyPath);

  const localeValue =
    get(langObject?.[localeCode], keyName) ||
    get(langObject?.[localeCode.split('-')[0]], keyName) ||
    langObject?.[keyName];

  if (typeof localeValue !== 'string') {
    return '';
  }

  return localeValue;
}

export function getEasyblocksPagePropsWithConfigs(
  allSections: ThemePageSectionSchema[],
  pageSections: ThemeSectionConfig[],
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
  pageId: string,
  lang: any,
) {
  console.log({ pageSections, allSections, layoutSectionGroups });
  const translateLabel = (label: string, fallback: string) => {
    return label?.startsWith('t:')
      ? renderLanguage(lang, label.split('t:')[1]) || fallback
      : fallback;
  };

  const getLayoutSectionGroupComponentProps = () => {
    return layoutSectionGroups.map((sectionGroup) => ({
      prop: `SectionGroup_${sectionGroup.id}`,
      type: 'component-collection',
      required: true,
      accepts: getAcceptedLayoutSections(sectionGroup.type),
    }));
  };

  const checkEnabledDisabledOn = (
    config: any,
    key: string,
    targetId: string,
  ) => {
    if (config.templates === '*') {
      return true;
    }
    if (config[key]?.includes(targetId)) {
      return true;
    }
    return false;
  };

  const getAcceptedSections = () => {
    return allSections
      .reduce((acc: string[], section) => {
        if (section.enabled_on) {
          if (checkEnabledDisabledOn(section.enabled_on, 'templates', pageId)) {
            acc.push(section.id);
          }
        } else if (section.disabled_on) {
          if (
            !checkEnabledDisabledOn(section.disabled_on, 'templates', pageId)
          ) {
            acc.push(section.id);
          }
        } else {
          // Default hide sections named after layout section group types
          if (
            !layoutSectionGroups.map(({ type }) => type).includes(section.id)
          ) {
            acc.push(section.id);
          }
        }
        return acc;
      }, [])
      .map((sectionId: string) => `${sectionId}`);
  };

  const getAcceptedLayoutSections = (groupType: string) => {
    return allSections
      .reduce((acc: string[], section) => {
        if (section.enabled_on) {
          if (checkEnabledDisabledOn(section.enabled_on, 'groups', groupType)) {
            acc.push(section.id);
          }
        } else if (section.disabled_on) {
          if (
            !checkEnabledDisabledOn(section.disabled_on, 'groups', groupType)
          ) {
            acc.push(section.id);
          }
        } else {
          // Default to section of the same type name
          // Note: limit is also supposed to be 1 for sections named after group types
          if (section.id === groupType) {
            acc.push(section.id);
          }
        }
        return acc;
      }, [])
      .map((sectionId: string) => `${sectionId}`);
  };

  const components = [
    {
      id: `swell_page`,
      label: 'Page: ' + pageId,
      schema: [
        {
          prop: 'ContentSections',
          type: 'component-collection',
          required: true,
          accepts: getAcceptedSections(),
          placeholderAppearance: {
            height: 250,
            label: 'Add section',
            aspectRatio: 1,
          },
        },
        ...getLayoutSectionGroupComponentProps(),
      ],
      styles: () => {
        return {
          styled: {
            Root: {},
          },
        };
      },
    },
    ...allSections.map((section) => {
      return {
        id: `${section.id}`,
        label: translateLabel(section.label, section.id),
        schema: [
          ...(section.fields || [])
            .map((field) => {
              if (!field.id || !field.type) return;
              return {
                prop: field.id,
                label: translateLabel(field.label, field.id),
                defaultValue: field.default,
                ...schemaToEasyblocksProps(lang, field),
              };
            })
            .filter(Boolean),
          ...(section?.blocks
            ? [
                {
                  prop: 'Blocks',
                  type: 'component-collection',
                  required: true,
                  accepts: section.blocks.map(
                    (block) => `Block__${section.id}__${block.type}`,
                  ),
                  // TODO: figure out how to make this work, doesn't work for collections normally
                  defaultValue: section.presets?.[0]?.blocks?.map((block) => {
                    const blockDef = section.blocks?.find(
                      ({ type }) => type === block.type,
                    );
                    if (!blockDef) return;
                    return {
                      _component: `Block__${section.id}__${block.type}`,
                      ...reduce(
                        blockDef.fields.filter((field) => field.id),
                        (acc, blockField) => ({
                          ...acc,
                          [blockField.id as string]: schemaToEasyblocksValue(
                            blockDef.fields,
                            blockField.id as string,
                            blockField.default,
                          ),
                        }),
                        {},
                      ),
                    };
                  }),
                  placeholderAppearance: {
                    height: 50,
                    label: 'Add block',
                    aspectRatio: 1,
                  },
                },
              ]
            : []),
        ],
        styles: () => {
          return {
            styled: {
              Root: {},
            },
          };
        },
      };
    }),
    ...allSections.reduce((acc: any[], section) => {
      if (section.blocks) {
        acc.push(
          ...section.blocks.map((block) => ({
            id: `Block__${section.id}__${block.type}`,
            label: translateLabel(block.label, block.type),
            schema: [
              ...(block.fields || [])
                .map((field) => {
                  if (!field.id || !field.type) return;
                  return {
                    prop: field.id,
                    label: translateLabel(field.label, field.id),
                    defaultValue: field.default,
                    ...schemaToEasyblocksProps(lang, field),
                  };
                })
                .filter(Boolean),
            ],
            styles: () => {
              return {
                styled: {
                  Root: {},
                },
              };
            },
          })),
        );
      }
      return acc;
    }, []),
  ];

  const getSectionGroupTemplateValues = () => {
    return layoutSectionGroups.reduce(
      (acc: any, sectionGroup: ThemeLayoutSectionGroupConfig) => ({
        ...acc,
        [`SectionGroup_${sectionGroup.id}`]: sectionGroup.sectionConfigs.map(
          ({ section, settings, schema }) => ({
            _id: `SectionGroup__${section.type}_${Math.random()}`,
            _component: `${section.type}`,
            ...reduce(
              settings?.section.settings,
              (acc, value, key) => ({
                ...acc,
                [key]: schemaToEasyblocksValue(schema?.fields, key, value),
              }),
              {},
            ),
            ...(settings?.section.blocks
              ? {
                  Blocks: settings.section.blocks.map((block: any) => ({
                    _id: `Block__${section.type}__${
                      block.type
                    }_${Math.random()}`,
                    _component: `Block__${section.type}__${block.type}`,
                    ...reduce(
                      block.settings,
                      (acc, value, key) => ({
                        ...acc,
                        [key]: schemaToEasyblocksValue(
                          schema?.blocks?.find(
                            ({ type }) => type === block.type,
                          )?.fields,
                          key,
                          value,
                        ),
                      }),
                      {},
                    ),
                  })),
                }
              : {}),
          }),
        ),
      }),
      {},
    );
  };

  const templates = [
    // TODO: add templates for all other components (sections) with preset setting defaults
    {
      id: `swell_page`,
      entry: {
        _id: `swell_page`,
        _component: `swell_page`,
        ContentSections: pageSections.map(({ section, settings, schema }) => ({
          _id: `${section.type}_${Math.random()}`,
          _component: `${section.type}`,
          ...reduce(
            settings?.section.settings,
            (acc, value, key) => ({
              ...acc,
              [key]: schemaToEasyblocksValue(schema?.fields, key, value),
            }),
            {},
          ),
          ...(settings?.section.blocks
            ? {
                Blocks: settings.section.blocks.map((block: any) => ({
                  _id: `Block__${section.type}__${block.type}_${Math.random()}`,
                  _component: `Block__${section.type}__${block.type}`,
                  ...reduce(
                    block.settings,
                    (acc, value, key) => ({
                      ...acc,
                      [key]: schemaToEasyblocksValue(
                        schema?.blocks?.find(({ type }) => type === block.type)
                          ?.fields,
                        key,
                        value,
                      ),
                    }),
                    {},
                  ),
                })),
              }
            : {}),
        })),
        ...getSectionGroupTemplateValues(),
      },
    },
  ];

  console.log({ components, templates });

  return {
    easyblocksConfig: {
      components,
      templates,
      hideCloseButton: true,
      allowSave: true,
      locales: [
        {
          code: 'en-US',
          isDefault: true,
        },
      ],
      types: {
        menu: {
          type: 'inline',
          widget: {
            id: 'menu',
            label: 'Navigation menu',
          },
          defaultValue: null,
        },
        boolean: {
          type: 'inline',
          widget: {
            id: 'swellBoolean',
          },
        },
        number: {
          type: 'inline',
          widget: {
            id: 'swellNumber',
          },
        },
        select: {
          type: 'inline',
          widget: {
            id: 'swellSelect',
          },
        },
        short_text: {
          type: 'inline',
          widget: {
            id: 'swellShortText',
          },
        },
        long_text: {
          type: 'inline',
          widget: {
            id: 'swellLongText',
          },
        },
        editor: {
          type: 'inline',
          widget: {
            id: 'swellEditor',
          },
        },
        file: {
          type: 'inline',
          widget: {
            id: 'swellFile',
          },
        },
      },
      tokens: {
        colors: [],
        fonts: [],
      },
    },
  };
}

export function schemaToEasyblocksProps(
  lang: any,
  field: ThemeSettingFieldSchema,
) {
  const sharedProps = {
    description: field.description,
    isLabelHidden: true,
    layout: 'column',
  };

  let typeProps;
  switch (field?.type) {
    case 'text':
    case 'short_text':
      typeProps = {
        type: 'short_text',
      };
      break;
    case 'textarea':
    case 'long_text':
      typeProps = {
        type: 'long_text',
      };
      break;

    case 'basic_html':
    case 'rich_text':
    case 'rich_html':
    case 'markdown':
    case 'liquid':
      typeProps = {
        type: 'editor',
      };
      break;

    case 'number':
      typeProps = {
        type: 'number',
        params: {
          min: field.min,
          max: field.max,
          unit: field.unit,
          increment: field.increment,
        },
      };
      break;

    case 'select':
      typeProps = {
        type: 'select',
        params: {
          options: field.options?.map((option) => ({
            label: option.label?.startsWith('t:')
              ? renderLanguage(lang, option.label.split('t:')[1]) ||
                option.label
              : option.label,
            value: option.value,
          })),
        },
      };
      break;

    case 'radio':
      typeProps = {
        type: 'radio-group',
        params: {
          options: field.options?.map((option) => ({
            label: option.label?.startsWith('t:')
              ? renderLanguage(lang, option.label.split('t:')[1]) ||
                option.label
              : option.label,
            value: option.value,
          })),
        },
      };
      break;

    case 'checkbox':
      typeProps = {
        type: 'boolean',
        defaultValue: field.default,
      };
      break;

    case 'color':
      typeProps = {
        type: 'color',
      };
      break;

    // TODO: custom types
    case 'menu':
      typeProps = {
        type: 'menu', // only testing
      };
      break;
    case 'lookup':
    case 'generic_lookup':
    case 'product_lookup':
    case 'category_lookup':
    case 'customer_lookup':
      typeProps = {
        type: 'menu', // only testing
      };
      break;
    case 'image':
    case 'document':
    case 'video':
    case 'color_scheme':
    case 'color_scheme_group':
    default:
      typeProps = {
        type: 'file',
      };
      break;
  }

  return {
    ...sharedProps,
    ...typeProps,
  };
}

export function getEasyblocksComponentDefinitions(
  props: {
    allSections: ThemePageSectionSchema[];
    layoutSectionGroups: ThemeLayoutSectionGroupConfig[];
  },
  pageId: string,
  getComponent: (type: string, data?: any) => any,
) {
  const { allSections, layoutSectionGroups } = props;

  console.log('getEasyblocksComponentDefinitions', {
    allSections,
    layoutSectionGroups,
  });

  const pageSectionComponents = allSections.reduce((acc: any, section) => {
    acc[`${section.id}`] = getComponent('pageSection', section);
    return acc;
  }, {});

  const layoutSectionGroupComponents = layoutSectionGroups.reduce(
    (acc: any, sectionGroup) => {
      acc[`SectionGroup___${sectionGroup.id}`] = getComponent(
        'layoutSectionGroup',
        sectionGroup,
      );
      return acc;
    },
    {},
  );

  const blockComponents = allSections.reduce((acc: any, section) => {
    if (section.blocks) {
      for (const block of section.blocks) {
        const blockId = `Block__${section.id}__${block.type}` as any;
        acc[blockId] = getComponent('block', { section, block });
      }
    }
    return acc;
  }, {});

  return {
    ...pageSectionComponents,
    ...layoutSectionGroupComponents,
    ...blockComponents,
    // Root component
    [`swell_page`]: getComponent('root'),
  };
}

export function schemaToEasyblocksValue(
  fields: ThemeSettingFieldSchema[] | undefined,
  fieldId: string,
  value: any,
) {
  const field = fields?.find((field) => field.id === fieldId);
  switch (field?.type) {
    // Note this should work for type "text" but it doesn't
    /* case "text":
    // Note these need a different component:
    case "textarea":
      return {
        id: Math.random().toString(),
        value: {
          ['en-US']: value || "",
        },
        widgetId: "@easyblocks/local-text"
      } */
    default:
      return value;
  }
}

export function getEasyblocksBackend(_: any) {
  const easyblocksBackend: Backend = {
    documents: {
      get: async ({ id }) => {
        const document = {
          id,
          version: 1,
          entry: {
            _id: 'page',
            _component: `page_${id}`,
          },
        } as Document;
        return document;
      },
      create: async (payload) => {
        return {} as Document;
      },
      update: async (payload) => {
        return {} as Document;
      },
    },
    templates: {
      get: async (payload) => {
        return {} as UserDefinedTemplate;
      },
      getAll: async () => {
        return [] as UserDefinedTemplate[];
      },
      create: async (payload) => {
        return {} as UserDefinedTemplate;
      },
      update: async (payload) => {
        return {} as UserDefinedTemplate;
      },
      delete: async (payload) => {
        return;
      },
    },
  };

  return easyblocksBackend;
}
