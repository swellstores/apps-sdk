import reduce from 'lodash/reduce';
import { Backend, Document, UserDefinedTemplate } from '@easyblocks/core';
import {
  getSectionSchema,
  renderTemplateSchema,
  filterSectionConfig,
  filterAllLayoutSectionGroupConfigs,
  filterLayoutSectionGroupConfig,
  schemaToEasyblocksProps,
  schemaToEasyblocksValue,
} from './utils';

export async function getEasyblocksPropsFromThemeConfigs(
  theme: SwellTheme,
  themeConfigs: SwellCollection,
  pageId: string,
) {
  const pageTemplate = await getPageTemplate(theme, pageId);
  const allSections = await getAllSections(theme, themeConfigs);
  const pageSections = await getPageSections(
    theme,
    pageTemplate as ThemeSectionGroup,
  );
  const layoutSectionGroups = await getLayoutSectionGroups(theme, themeConfigs);

  return {
    pageTemplate,
    allSections,
    pageSections,
    layoutSectionGroups,
  };
}

export async function getPageTemplate(theme: SwellTheme, pageId: string) {
  return await theme.renderPageTemplate(pageId);
}

export async function getAllSections(
  theme: SwellTheme,
  themeConfigs: SwellCollection,
): Promise<ThemeSectionSchema[]> {
  if (!themeConfigs?.results) return [];

  return await Promise.all(
    themeConfigs.results
      .filter((config) => filterSectionConfig(config, themeConfigs))
      .map(async (config: SwellRecord) => {
        const schema = await renderTemplateSchema(
          theme,
          config as SwellThemeConfig,
        );
        return {
          ...schema,
          id: config.name.split('.').pop(),
        };
      }),
  );
}

export async function getPageSections(
  theme: SwellTheme,
  sectionGroup: ThemeSectionGroup | SwellRecord,
  getSectionSchemaHandler: any = getSectionSchema,
): Promise<ThemeSectionConfig[]> {
  const order =
    sectionGroup.order instanceof Array
      ? sectionGroup.order
      : Object.keys(sectionGroup.sections || {});

  const sections = (
    await Promise.all(
      order.map((key: string): Promise<ThemeSectionConfig | void> => {
        return new Promise(async (resolve) => {
          const section: ThemeSection = sectionGroup.sections[key];

          const schema = await getSectionSchemaHandler(theme, section.type);
          if (!schema) {
            return resolve();
          }

          const id = sectionGroup.id
            ? `page__${sectionGroup.id}__${key}`
            : schema.id;

          const blockOrder =
            section.block_order instanceof Array
              ? section.block_order
              : Object.keys(section.blocks || {});

          const blocks: ThemeSettingsBlock[] = (
            await Promise.all(
              blockOrder.map((key: string) => section.blocks?.[key]),
            )
          ).filter(Boolean) as ThemeSettingsBlock[];

          const settings = {
            section: {
              id,
              ...section,
              blocks,
            },
          };

          resolve({
            id: id as string,
            settings: settings as ThemeSectionSettings,
            section: { id, ...section },
            tag: schema.tag || 'div',
            class: schema.class,
            schema,
          });
        });
      }),
    )
  ).filter(Boolean) as ThemeSectionConfig[];

  return sections;
}

export async function getLayoutSectionGroups(
  theme: SwellTheme,
  themeConfigs: SwellCollection,
): Promise<ThemeLayoutSectionGroupConfig[]> {
  if (!themeConfigs?.results) return [];

  const layoutSectionGroupConfigs = themeConfigs.results.filter((config) =>
    filterAllLayoutSectionGroupConfigs(config, themeConfigs),
  );

  const getSectionSchema = async (
    theme: SwellTheme,
    type: string,
  ): Promise<ThemeSectionSchema | undefined> => {
    const config = themeConfigs.results.find((config) =>
      filterLayoutSectionGroupConfig(config, themeConfigs, type),
    );

    const schema = await renderTemplateSchema(
      theme,
      config as SwellThemeConfig,
    );

    return {
      ...schema,
      id: config?.name.split('.').pop(),
    };
  };

  return await Promise.all(
    layoutSectionGroupConfigs.map(
      (config: SwellRecord): Promise<ThemeLayoutSectionGroupConfig> => {
        return new Promise(async (resolve: any) => {
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
              theme,
              sectionGroup,
              getSectionSchema,
            );
            resolve({
              ...sectionGroup,
              id: config.name.split('.').pop(),
              sectionConfigs,
            });
          } else {
            resolve();
          }
        });
      },
    ),
  ).then((result: any[]) => result.filter(Boolean));
}

export function getEasyblocksPagePropsWithConfigs(
  allSections: ThemePageSectionSchema[],
  pageSections: ThemeSectionConfig[],
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
  pageId: string,
  lang: any,
) {
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
        label: section.label,
        schema: [
          ...(section.fields || [])
            .map((field) => {
              if (!field.id || !field.type) return;
              return {
                prop: field.id,
                label: field.label,
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
            label: block.label,
            schema: [
              ...(block.fields || [])
                .map((field) => {
                  if (!field.id || !field.type) return;
                  return {
                    prop: field.id,
                    label: field.label,
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

  return {
    easyblocksConfig: {
      components,
      templates,
      backend: getEasyblocksBackend(),
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
      },
      tokens: {
        colors: [],
        fonts: [],
      },
    },
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

export function getEasyblocksBackend() {
  // Only a mock backend for now
  const easyblocksBackend: Backend = {
    documents: {
      get: async ({ id }) => {
        const document = {
          id,
          version: 1,
          entry: {
            _id: 'page',
            _component: `swell_page`,
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
